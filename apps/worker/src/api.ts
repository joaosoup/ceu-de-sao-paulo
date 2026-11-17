import { DEFAULT_CELL_SIZE_DEG } from "@ceu/sky-engine";
import { ISS_NORAD_ID, type Env } from "./env.js";
import { isValidOmm, loadElements, saveElements } from "./elements.js";
import { isGridCell } from "./grid.js";
import { refreshAndEnqueue } from "./precompute.js";
import { DAY_MS, HOUR_MS } from "./time.js";

const json = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", ...headers } });
const error = (status: number, message: string) => json({ error: message }, status);

/** Só aceitamos endpoints dos serviços de push conhecidos: evita usar o Worker para chamar URLs arbitrárias. */
const PUSH_HOSTS = [/^fcm\.googleapis\.com$/, /\.push\.apple\.com$/, /^updates\.push\.services\.mozilla\.com$/, /\.notify\.windows\.com$/];
export function isAllowedPushEndpoint(endpoint: unknown): endpoint is string {
  if (typeof endpoint !== "string" || endpoint.length > 1000) return false;
  try {
    const u = new URL(endpoint);
    return u.protocol === "https:" && PUSH_HOSTS.some((re) => re.test(u.hostname));
  } catch {
    return false;
  }
}

interface Prefs {
  minIndex?: unknown;
  leadMinutes?: unknown;
  allowNight?: unknown;
  weeklyCap?: unknown;
}
export function normalizePrefs(p: Prefs | undefined) {
  const int = (v: unknown, lo: number, hi: number, dflt: number) =>
    typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : dflt;
  return {
    minIndex: int(p?.minIndex, 30, 90, 50),
    leadMinutes: int(p?.leadMinutes, 5, 60, 15),
    allowNight: p?.allowNight === true ? 1 : 0,
    weeklyCap: int(p?.weeklyCap, 1, 99, 3),
  };
}

const b64url = /^[A-Za-z0-9_-]{16,200}$/;
const randomToken = () => [...crypto.getRandomValues(new Uint8Array(24))].map((b) => b.toString(16).padStart(2, "0")).join("");

async function authSubscription(env: Env, req: Request, id: string): Promise<boolean> {
  const secret = req.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  if (!secret) return false;
  const row = await env.DB.prepare("SELECT secret FROM subscriptions WHERE id = ?").bind(id).first<{ secret: string }>();
  return row !== null && row.secret === secret;
}

export async function handleApi(req: Request, env: Env, now: number): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/+$/, "");
  const seg = path.split("/").slice(2); // depois de /api
  const method = req.method;

  if (method === "GET" && path === "/api/config") {
    return json({ vapidPublicKey: env.VAPID_PUBLIC_KEY ?? null, cellSizeDeg: DEFAULT_CELL_SIZE_DEG }, 200, { "cache-control": "public, max-age=3600" });
  }

  if (method === "GET" && path === "/api/health") {
    const el = await loadElements(env, ISS_NORAD_ID);
    const counts = await env.DB.prepare(
      "SELECT (SELECT COUNT(*) FROM events WHERE starts_at > ?1) AS upcoming, " +
        "(SELECT COUNT(*) FROM deliveries WHERE status = 'sent' AND sent_at > ?2) AS sent7d, " +
        "(SELECT COUNT(*) FROM deliveries WHERE status = 'failed' AND sent_at > ?2) AS failed7d, " +
        "(SELECT COUNT(*) FROM feedback WHERE created_at > ?2) AS feedback7d, " +
        "(SELECT COUNT(*) FROM feedback WHERE created_at > ?2 AND saw = 1) AS saw7d",
    )
      .bind(now, now - 7 * DAY_MS)
      .first();
    const ageH = el ? Math.round(((now - el.epochMs) / HOUR_MS) * 10) / 10 : null;
    return json({ ok: ageH !== null && ageH <= 48, elementsAgeHours: ageH, ...counts });
  }

  // GET /api/cells/:id/events
  if (method === "GET" && seg[0] === "cells" && seg[2] === "events" && seg.length === 3) {
    const cell = decodeURIComponent(seg[1] ?? "");
    if (!isGridCell(cell)) return error(404, "Célula fora da área atendida");
    const rows = await env.DB.prepare(
      "SELECT e.id, e.kind, e.starts_at, e.peak_at, e.ends_at, e.payload, e.geom_score, e.quiet, e.elements_epoch, " +
        "d.quality_index, d.decision, d.reason, d.clouds FROM events e LEFT JOIN decisions d ON d.event_id = e.id " +
        "WHERE e.cell_id = ? AND e.ends_at > ? AND e.starts_at < ? ORDER BY e.starts_at LIMIT 100",
    )
      .bind(cell, now - HOUR_MS, now + 11 * DAY_MS)
      .all<Record<string, unknown>>();
    const el = await loadElements(env, ISS_NORAD_ID);
    return json(
      {
        cellId: cell,
        generatedAt: now,
        elementsEpoch: el?.epochMs ?? null,
        events: rows.results.map((r) => ({
          id: r.id, kind: r.kind, startsAt: r.starts_at, peakAt: r.peak_at, endsAt: r.ends_at,
          details: JSON.parse(r.payload as string), geometryScore: r.geom_score, quiet: r.quiet === 1,
          decision: r.decision ? { index: r.quality_index, alert: r.decision === "alert", reason: r.reason, clouds: r.clouds ? JSON.parse(r.clouds as string) : null } : null,
        })),
      },
      200,
      { "cache-control": "public, max-age=300" },
    );
  }

  // POST /api/subscriptions
  if (method === "POST" && path === "/api/subscriptions") {
    const body = (await req.json().catch(() => null)) as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown }; cellId?: unknown; prefs?: Prefs } | null;
    if (!body || !isAllowedPushEndpoint(body.endpoint)) return error(400, "Endpoint de push inválido");
    const { p256dh, auth } = body.keys ?? {};
    if (typeof p256dh !== "string" || typeof auth !== "string" || !b64url.test(p256dh) || !b64url.test(auth)) return error(400, "Chaves de push inválidas");
    if (typeof body.cellId !== "string" || !isGridCell(body.cellId)) return error(400, "Célula fora da área atendida");
    const p = normalizePrefs(body.prefs);
    const id = crypto.randomUUID();
    const secret = randomToken();
    // Mesmo aparelho inscrevendo de novo: atualiza e devolve as credenciais novas.
    const row = await env.DB.prepare(
      "INSERT INTO subscriptions (id, secret, endpoint, p256dh, auth, cell_id, min_index, lead_minutes, allow_night, weekly_cap, created_at, last_seen_at) " +
        "VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?11) " +
        "ON CONFLICT (endpoint) DO UPDATE SET secret = ?2, p256dh = ?4, auth = ?5, cell_id = ?6, min_index = ?7, lead_minutes = ?8, allow_night = ?9, weekly_cap = ?10, last_seen_at = ?11, fail_count = 0 " +
        "RETURNING id, secret",
    )
      .bind(id, secret, body.endpoint, p256dh, auth, body.cellId, p.minIndex, p.leadMinutes, p.allowNight, p.weeklyCap, now)
      .first<{ id: string; secret: string }>();
    return json(row, 201);
  }

  // PATCH | DELETE /api/subscriptions/:id
  if (seg[0] === "subscriptions" && seg.length === 2 && (method === "PATCH" || method === "DELETE")) {
    const id = seg[1] ?? "";
    if (!(await authSubscription(env, req, id))) return error(401, "Não autorizado");
    if (method === "DELETE") {
      // "Desativar e apagar meus dados": some a inscrição; o feedback fica sem vínculo com ela.
      await env.DB.batch([
        env.DB.prepare("DELETE FROM deliveries WHERE subscription_id = ?").bind(id),
        env.DB.prepare("UPDATE feedback SET subscription_id = 'anon-' || lower(hex(randomblob(8))) WHERE subscription_id = ?").bind(id),
        env.DB.prepare("DELETE FROM subscriptions WHERE id = ?").bind(id),
      ]);
      return new Response(null, { status: 204 });
    }
    const body = (await req.json().catch(() => null)) as { cellId?: unknown; prefs?: Prefs } | null;
    if (!body) return error(400, "Corpo inválido");
    if (body.cellId !== undefined && (typeof body.cellId !== "string" || !isGridCell(body.cellId))) return error(400, "Célula fora da área atendida");
    const p = normalizePrefs(body.prefs);
    await env.DB.prepare(
      "UPDATE subscriptions SET cell_id = COALESCE(?1, cell_id), min_index = ?2, lead_minutes = ?3, allow_night = ?4, weekly_cap = ?5, last_seen_at = ?6 WHERE id = ?7",
    )
      .bind(body.cellId ?? null, p.minIndex, p.leadMinutes, p.allowNight, p.weeklyCap, now, id)
      .run();
    return json({ ok: true });
  }

  // POST /api/feedback
  if (method === "POST" && path === "/api/feedback") {
    const body = (await req.json().catch(() => null)) as { eventId?: unknown; subscriptionId?: unknown; saw?: unknown; reason?: unknown } | null;
    if (!body || typeof body.eventId !== "string" || typeof body.subscriptionId !== "string" || typeof body.saw !== "boolean") return error(400, "Corpo inválido");
    if (!(await authSubscription(env, req, body.subscriptionId))) return error(401, "Não autorizado");
    const reason = typeof body.reason === "string" && ["nuvens", "nao_achei", "predios", "outro"].includes(body.reason) ? body.reason : null;
    const ev = await env.DB.prepare("SELECT 1 FROM events WHERE id = ?").bind(body.eventId).first();
    if (!ev) return error(404, "Evento não encontrado");
    await env.DB.prepare(
      "INSERT INTO feedback (event_id, subscription_id, saw, reason, created_at) VALUES (?1, ?2, ?3, ?4, ?5) " +
        "ON CONFLICT (event_id, subscription_id) DO UPDATE SET saw = ?3, reason = ?4, created_at = ?5",
    )
      .bind(body.eventId, body.subscriptionId, body.saw ? 1 : 0, reason, now)
      .run();
    return json({ ok: true });
  }

  // Rotas administrativas (token): disparar o ciclo à mão e subir elementos manualmente (plano B do CelesTrak).
  if (seg[0] === "admin") {
    const token = req.headers.get("authorization")?.replace(/^Bearer /, "");
    if (!env.ADMIN_TOKEN || token !== env.ADMIN_TOKEN) return error(401, "Não autorizado");
    if (method === "POST" && seg[1] === "elements") {
      const body: unknown = await req.json().catch(() => null);
      const omm = Array.isArray(body) ? body[0] : body;
      if (!isValidOmm(omm)) return error(400, "OMM inválido");
      await saveElements(env, omm, now);
      return json({ ok: true, noradId: omm.NORAD_CAT_ID });
    }
    if (method === "POST" && seg[1] === "refresh") {
      const skipFetch = url.searchParams.get("skipFetch") === "1";
      return json({ ok: true, result: await refreshAndEnqueue(env, now, { skipFetch }) });
    }
  }

  return error(404, "Rota não encontrada");
}
