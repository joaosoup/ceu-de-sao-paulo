import * as Astronomy from "astronomy-engine";
import { cellCenter, findVisiblePasses, localSolarEclipses, passGeometryScore, type VisiblePass } from "@ceu/sky-engine";
import { ALERT_AGE_WARNING_H, HORIZON_DAYS, ISS_NORAD_ID, type Env, type PrecomputeTask } from "./env.js";
import { fetchElementsFromCelestrak, loadElements, ommEpochMs, saveElements } from "./elements.js";
import { GRID_CELLS } from "./grid.js";
import { notifyOperator } from "./ops.js";
import { DAY_MS, HOUR_MS, MIN_MS, isQuietHour, localDayStart, nightKey } from "./time.js";

/** Cron 2x/dia: atualiza elementos, enfileira o pré-cálculo e faz a faxina. */
export async function refreshAndEnqueue(env: Env, now: number, opts: { skipFetch?: boolean } = {}): Promise<string> {
  if (!opts.skipFetch) {
    const fetched = await fetchElementsFromCelestrak(ISS_NORAD_ID);
    if (fetched.ok) await saveElements(env, fetched.omm, now);
    else await notifyOperator(env, `CelesTrak respondeu ${fetched.status}: ${fetched.detail}. Sem nova tentativa até o próximo ciclo.`);
  }

  const stored = await loadElements(env, ISS_NORAD_ID);
  if (!stored) return "sem elementos: nada a calcular";
  const ageH = (now - stored.epochMs) / HOUR_MS;
  if (ageH > ALERT_AGE_WARNING_H) await notifyOperator(env, `Elementos da ISS com ${ageH.toFixed(0)} h. Acima de 48 h os alertas de satélite param.`);

  const firstDay = localDayStart(now);
  const tasks: PrecomputeTask[] = [];
  for (const cell of GRID_CELLS) {
    for (let d = 0; d < HORIZON_DAYS; d++) tasks.push({ t: "pass", cell, dayStart: firstDay + d * DAY_MS, norad: ISS_NORAD_ID });
  }
  // Eclipse solar: só enfileira quando há um eclipse (em qualquer lugar do mundo) na janela.
  const nextGlobal = Astronomy.SearchGlobalSolarEclipse(new Date(now - DAY_MS));
  if (nextGlobal.peak.date.getTime() < now + (HORIZON_DAYS + 1) * DAY_MS) {
    for (const cell of GRID_CELLS) tasks.push({ t: "eclipse", cell });
  }
  for (let i = 0; i < tasks.length; i += 100) {
    await env.PRECOMPUTE_QUEUE.sendBatch(tasks.slice(i, i + 100).map((body) => ({ body })));
  }

  await cleanup(env, now);
  return `${tasks.length} tarefas enfileiradas; elementos com ${ageH.toFixed(1)} h`;
}

async function cleanup(env: Env, now: number): Promise<void> {
  const old = now - 30 * DAY_MS;
  await env.DB.batch([
    env.DB.prepare("DELETE FROM deliveries WHERE event_id IN (SELECT id FROM events WHERE ends_at < ?)").bind(old),
    env.DB.prepare("DELETE FROM decisions WHERE event_id IN (SELECT id FROM events WHERE ends_at < ?)").bind(old),
    env.DB.prepare("DELETE FROM events WHERE ends_at < ?").bind(old),
    env.DB.prepare("DELETE FROM weather_cache WHERE fetched_at < ?").bind(now - 2 * DAY_MS),
    // LGPD: inscrição sem uso há 90 dias, ou com falhas repetidas, é apagada.
    env.DB.prepare("DELETE FROM subscriptions WHERE last_seen_at < ? OR fail_count >= 5").bind(now - 90 * DAY_MS),
    env.DB.prepare("DELETE FROM deliveries WHERE subscription_id NOT IN (SELECT id FROM subscriptions)"),
  ]);
}

export interface PassPayload {
  kind: "pass";
  objectName: string;
  start: { az: number; el: number };
  peak: { az: number; el: number };
  end: { az: number; el: number };
  durationSeconds: number;
  magnitude: number;
  startsInShadow: boolean;
  endsInShadow: boolean;
}

export interface EclipsePayload {
  kind: "solar_eclipse";
  eclipseKind: string;
  obscuration: number;
  sunAltitudeAtPeak: number;
}

const round1 = (x: number) => Math.round(x * 10) / 10;

export function passToPayload(p: VisiblePass): PassPayload {
  const pt = (s: { azimuth: number; elevation: number }) => ({ az: round1(s.azimuth), el: round1(s.elevation) });
  return {
    kind: "pass",
    objectName: p.noradId === ISS_NORAD_ID ? "ISS" : p.objectName,
    start: pt(p.start),
    peak: pt(p.peak),
    end: pt(p.end),
    durationSeconds: p.durationSeconds,
    magnitude: round1(p.magnitude),
    startsInShadow: p.startsInShadow,
    endsInShadow: p.endsInShadow,
  };
}

/** Consumidor da fila: 1 célula x 1 dia x 1 satélite. Precisa caber em 10 ms de CPU. */
export async function runPrecomputeTask(env: Env, task: PrecomputeTask, now: number): Promise<void> {
  if (task.t === "eclipse") return runEclipseTask(env, task.cell, now);

  const stored = await loadElements(env, task.norad);
  if (!stored) return;
  const passes = findVisiblePasses(stored.omm, cellCenter(task.cell), { from: new Date(task.dayStart), days: 1 });

  // Ids estáveis: uma passagem recalculada com elementos novos muda alguns segundos.
  // Casa com a linha existente pelo pico (±5 min) em vez de recriar, para não quebrar
  // decisões, entregas e feedback que apontam para o id.
  const existing = await env.DB.prepare(
    "SELECT id, peak_at FROM events WHERE cell_id = ? AND kind = 'pass' AND norad_id = ? AND peak_at >= ? AND peak_at < ?",
  )
    .bind(task.cell, task.norad, task.dayStart - 5 * MIN_MS, task.dayStart + DAY_MS + 5 * MIN_MS)
    .all<{ id: string; peak_at: number }>();
  const unmatched = new Map(existing.results.map((r) => [r.id, r.peak_at]));
  const stmts: D1PreparedStatement[] = [];

  for (const p of passes) {
    const peakAt = p.peak.time.getTime();
    let id: string | null = null;
    for (const [eid, ePeak] of unmatched) {
      if (Math.abs(ePeak - peakAt) <= 5 * MIN_MS) {
        id = eid;
        break;
      }
    }
    if (id) unmatched.delete(id);
    else id = `${task.cell}|${task.norad}|${new Date(peakAt).toISOString().slice(0, 16)}`;
    const startsAt = p.start.time.getTime();
    stmts.push(
      env.DB.prepare(
        "INSERT INTO events (id, cell_id, kind, norad_id, starts_at, peak_at, ends_at, payload, geom_score, quiet, night_key, elements_epoch, computed_at) " +
          "VALUES (?1, ?2, 'pass', ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12) " +
          "ON CONFLICT (id) DO UPDATE SET starts_at = ?4, peak_at = ?5, ends_at = ?6, payload = ?7, geom_score = ?8, quiet = ?9, night_key = ?10, elements_epoch = ?11, computed_at = ?12",
      ).bind(
        id, task.cell, task.norad, startsAt, peakAt, p.end.time.getTime(), JSON.stringify(passToPayload(p)),
        round1(passGeometryScore(p)), isQuietHour(startsAt) ? 1 : 0, nightKey(startsAt), ommEpochMs(stored.omm), now,
      ),
    );
  }
  // Passagem que deixou de existir: apaga, a menos que já tenha decisão (alerta pode ter saído).
  const lo = Math.max(task.dayStart, now);
  for (const [eid, ePeak] of unmatched) {
    if (ePeak >= lo && ePeak < task.dayStart + DAY_MS) {
      stmts.push(env.DB.prepare("DELETE FROM events WHERE id = ? AND NOT EXISTS (SELECT 1 FROM decisions WHERE event_id = ?)").bind(eid, eid));
    }
  }
  if (stmts.length) await env.DB.batch(stmts);
}

async function runEclipseTask(env: Env, cell: string, now: number): Promise<void> {
  const list = localSolarEclipses(cellCenter(cell), new Date(now - DAY_MS), new Date(now + (HORIZON_DAYS + 1) * DAY_MS));
  const stmts = list
    .filter((e) => e.sunAltitudeAtPeak > 0)
    .map((e) => {
      const payload: EclipsePayload = { kind: "solar_eclipse", eclipseKind: e.kind, obscuration: Math.round(e.obscuration * 1000) / 1000, sunAltitudeAtPeak: round1(e.sunAltitudeAtPeak) };
      const start = e.partialBegin.getTime();
      return env.DB.prepare(
        "INSERT INTO events (id, cell_id, kind, starts_at, peak_at, ends_at, payload, geom_score, quiet, night_key, computed_at) " +
          "VALUES (?1, ?2, 'solar_eclipse', ?3, ?4, ?5, ?6, ?7, 0, ?8, ?9) " +
          "ON CONFLICT (id) DO UPDATE SET starts_at = ?3, peak_at = ?4, ends_at = ?5, payload = ?6, geom_score = ?7, computed_at = ?9",
      ).bind(
        `${cell}|eclipse|${e.peak.toISOString().slice(0, 10)}`, cell, start, e.peak.getTime(), e.partialEnd.getTime(),
        JSON.stringify(payload), Math.round(60 + 40 * e.obscuration), `eclipse-${e.peak.toISOString().slice(0, 10)}`, now,
      );
    });
  if (stmts.length) await env.DB.batch(stmts);
}
