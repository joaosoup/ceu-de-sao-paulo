import { observationIndex, type CloudCover } from "@ceu/sky-engine";
import { DEFAULT_ALERT_INDEX, MAX_ELEMENTS_AGE_H, NO_WEATHER_MIN_GEOMETRY, SEND_BATCH, type Env, type SendTask } from "./env.js";
import { DAY_MS, HOUR_MS, MIN_MS } from "./time.js";
import { cloudsFor, openMeteo, type WeatherProvider } from "./weather.js";

interface PendingEvent {
  id: string;
  cell_id: string;
  kind: "pass" | "solar_eclipse";
  starts_at: number;
  peak_at: number;
  geom_score: number;
  quiet: number;
  night_key: string;
  elements_epoch: number | null;
}

export interface Decision {
  index: number;
  decision: "alert" | "skip";
  reason: string | null;
}

/** Regra pura da decisão, separada para ser testável. */
export function decide(geomScore: number, clouds: CloudCover | null, elementsAgeH: number | null): Decision {
  if (elementsAgeH !== null && elementsAgeH > MAX_ELEMENTS_AGE_H) {
    return { index: 0, decision: "skip", reason: "elementos_velhos" };
  }
  const index = observationIndex(geomScore, clouds);
  if (!clouds) {
    return geomScore >= NO_WEATHER_MIN_GEOMETRY
      ? { index, decision: "alert", reason: "sem_previsao" }
      : { index, decision: "skip", reason: "sem_previsao" };
  }
  if (index >= DEFAULT_ALERT_INDEX) return { index, decision: "alert", reason: null };
  const geomOnly = observationIndex(geomScore, null);
  return { index, decision: "skip", reason: geomOnly >= DEFAULT_ALERT_INDEX ? "nuvens" : "geometria_fraca" };
}

/**
 * Cron de 1 em 1 minuto, parte 1: decide eventos que começam em 20 a 120 minutos.
 * A distribuição para os inscritos é feita em SQL (um INSERT ... SELECT), não em laço:
 * custa quase nada de CPU, o recurso escasso do plano gratuito.
 */
export async function decideUpcoming(env: Env, now: number, provider: WeatherProvider = openMeteo): Promise<number> {
  const pending = await env.DB.prepare(
    "SELECT e.id, e.cell_id, e.kind, e.starts_at, e.peak_at, e.geom_score, e.quiet, e.night_key, e.elements_epoch " +
      "FROM events e LEFT JOIN decisions d ON d.event_id = e.id " +
      "WHERE d.event_id IS NULL AND e.starts_at BETWEEN ? AND ? ORDER BY e.starts_at LIMIT 8",
  )
    .bind(now + 20 * MIN_MS, now + 120 * MIN_MS)
    .all<PendingEvent>();

  for (const ev of pending.results) {
    const ageH = ev.elements_epoch === null ? null : (ev.starts_at - ev.elements_epoch) / HOUR_MS;
    const stale = ageH !== null && ageH > MAX_ELEMENTS_AGE_H;
    const clouds = stale ? null : await cloudsFor(env, ev.cell_id, ev.peak_at, now, provider);
    const d = decide(ev.geom_score, clouds, ageH);

    const stmts = [
      env.DB.prepare(
        "INSERT OR IGNORE INTO decisions (event_id, clouds, quality_index, decision, reason, decided_at) VALUES (?, ?, ?, ?, ?, ?)",
      ).bind(ev.id, clouds ? JSON.stringify(clouds) : null, d.index, d.decision, d.reason, now),
    ];
    if (d.decision === "alert") {
      stmts.push(
        env.DB.prepare(
          "INSERT OR IGNORE INTO deliveries (event_id, subscription_id, night_key, send_at, status) " +
            "SELECT ?1, s.id, ?2, MAX(?3 - s.lead_minutes * 60000, ?4), 'pending' FROM subscriptions s " +
            "WHERE s.cell_id = ?5 AND s.min_index <= ?6 AND (s.allow_night = 1 OR ?7 = 0) " +
            // no máximo um alerta por noite
            "AND NOT EXISTS (SELECT 1 FROM deliveries x WHERE x.subscription_id = s.id AND x.night_key = ?2) " +
            // e um teto por semana
            "AND (SELECT COUNT(*) FROM deliveries w WHERE w.subscription_id = s.id AND w.send_at > ?8) < s.weekly_cap",
        ).bind(ev.id, ev.night_key, ev.starts_at, now, ev.cell_id, d.index, ev.quiet, now - 7 * DAY_MS),
      );
    }
    await env.DB.batch(stmts);
  }
  return pending.results.length;
}

/** Parte 2: libera as entregas cujo horário chegou, em lotes pequenos para a fila de envio. */
export async function dispatchDue(env: Env, now: number): Promise<number> {
  await env.DB.prepare(
    "UPDATE deliveries SET status = 'expired' WHERE status = 'pending' AND event_id IN (SELECT id FROM events WHERE ends_at < ?)",
  )
    .bind(now)
    .run();

  const due = await env.DB.prepare(
    "UPDATE deliveries SET status = 'queued' WHERE rowid IN (" +
      "SELECT d.rowid FROM deliveries d JOIN events e ON e.id = d.event_id " +
      "WHERE d.status = 'pending' AND d.send_at <= ? AND e.ends_at > ? ORDER BY d.send_at LIMIT 300" +
      ") RETURNING event_id, subscription_id",
  )
    .bind(now, now)
    .all<{ event_id: string; subscription_id: string }>();

  const messages: { body: SendTask }[] = [];
  for (let i = 0; i < due.results.length; i += SEND_BATCH) {
    messages.push({ body: { t: "send", items: due.results.slice(i, i + SEND_BATCH).map((r) => ({ e: r.event_id, s: r.subscription_id })) } });
  }
  for (let i = 0; i < messages.length; i += 100) await env.SEND_QUEUE.sendBatch(messages.slice(i, i + 100));
  return due.results.length;
}
