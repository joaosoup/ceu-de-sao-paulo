import type { Env, SendTask } from "./env.js";
import { buildPushText } from "./messages.js";
import type { EclipsePayload, PassPayload } from "./precompute.js";
import { buildPushRequest } from "./webpush.js";

interface Row {
  event_id: string;
  subscription_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  starts_at: number;
  peak_at: number;
  ends_at: number;
  payload: string;
  quality_index: number | null;
  clouds: string | null;
}

/** Formato que o service worker do Angular (ngsw) entende sem código extra. */
export function buildNotificationPayload(row: Pick<Row, "event_id" | "starts_at" | "peak_at" | "payload" | "quality_index" | "clouds">) {
  const payload = JSON.parse(row.payload) as PassPayload | EclipsePayload;
  const text = buildPushText(payload, row.starts_at, row.peak_at, row.quality_index ?? 0, row.clouds !== null);
  const url = `/evento/${encodeURIComponent(row.event_id)}`;
  return {
    notification: {
      title: text.title,
      body: text.body,
      icon: "/icons/icon-192x192.png",
      badge: "/icons/icon-72x72.png",
      tag: row.event_id,
      data: { url, onActionClick: { default: { operation: "navigateLastFocusedOrOpen", url } } },
    },
  };
}

type PushFetcher = (endpoint: string, init: RequestInit) => Promise<Response>;

/** Consumidor da fila de envio: até 6 mensagens (~1 ms de CPU cada para criptografar). */
export async function runSendTask(env: Env, task: SendTask, now: number, doFetch: PushFetcher = fetch): Promise<void> {
  const stmts: D1PreparedStatement[] = [];
  for (const item of task.items) {
    const row = await env.DB.prepare(
      "SELECT d.event_id, d.subscription_id, s.endpoint, s.p256dh, s.auth, e.starts_at, e.peak_at, e.ends_at, e.payload, c.quality_index, c.clouds " +
        "FROM deliveries d JOIN subscriptions s ON s.id = d.subscription_id JOIN events e ON e.id = d.event_id " +
        "LEFT JOIN decisions c ON c.event_id = e.id WHERE d.event_id = ? AND d.subscription_id = ? AND d.status = 'queued'",
    )
      .bind(item.e, item.s)
      .first<Row>();
    if (!row) continue;
    const mark = (status: string) =>
      env.DB.prepare("UPDATE deliveries SET status = ?, sent_at = ? WHERE event_id = ? AND subscription_id = ?").bind(status, now, item.e, item.s);
    if (row.ends_at <= now) {
      stmts.push(mark("expired"));
      continue;
    }
    try {
      // A mensagem expira no fim do evento: celular que voltou a ter sinal depois não mostra alerta vencido.
      const ttl = Math.min(86_400, Math.max(60, Math.round((row.ends_at - now) / 1000)));
      const req = await buildPushRequest(
        { endpoint: row.endpoint, p256dh: row.p256dh, auth: row.auth },
        buildNotificationPayload(row),
        { vapidPrivateJwk: JSON.parse(env.VAPID_PRIVATE_KEY) as JsonWebKey, subject: env.VAPID_SUBJECT, ttlSeconds: ttl, urgency: "high", nowMs: now },
      );
      const res = await doFetch(req.endpoint, { method: "POST", headers: req.headers, body: req.body });
      if (res.status === 404 || res.status === 410) {
        // inscrição morta: apaga na hora
        stmts.push(mark("failed"), env.DB.prepare("DELETE FROM subscriptions WHERE id = ?").bind(item.s));
      } else if (res.ok) {
        stmts.push(mark("sent"), env.DB.prepare("UPDATE subscriptions SET fail_count = 0, last_seen_at = ? WHERE id = ?").bind(now, item.s));
      } else {
        stmts.push(mark("failed"), env.DB.prepare("UPDATE subscriptions SET fail_count = fail_count + 1 WHERE id = ?").bind(item.s));
      }
    } catch (err) {
      console.warn(`falha no envio: ${String(err)}`);
      stmts.push(mark("failed"));
    }
  }
  if (stmts.length) await env.DB.batch(stmts);
}
