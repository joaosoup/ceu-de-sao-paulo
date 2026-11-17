import type { OmmElements } from "@ceu/sky-engine";
import type { Env } from "./env.js";

const CELESTRAK_URL = "https://celestrak.org/NORAD/elements/gp.php";

export interface StoredElements {
  omm: OmmElements;
  epochMs: number;
  fetchedAt: number;
}

export function ommEpochMs(omm: OmmElements): number {
  return Date.parse(omm.EPOCH.endsWith("Z") ? omm.EPOCH : `${omm.EPOCH}Z`);
}

export function isValidOmm(x: unknown): x is OmmElements {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  const nums = ["MEAN_MOTION", "ECCENTRICITY", "INCLINATION", "RA_OF_ASC_NODE", "ARG_OF_PERICENTER", "MEAN_ANOMALY", "NORAD_CAT_ID", "BSTAR"];
  return typeof o.EPOCH === "string" && typeof o.OBJECT_NAME === "string" && nums.every((k) => typeof o[k] === "number" && Number.isFinite(o[k]));
}

export async function loadElements(env: Env, noradId: number): Promise<StoredElements | null> {
  const row = await env.DB.prepare("SELECT omm_json, epoch_ms, fetched_at FROM elements WHERE norad_id = ?")
    .bind(noradId)
    .first<{ omm_json: string; epoch_ms: number; fetched_at: number }>();
  return row ? { omm: JSON.parse(row.omm_json) as OmmElements, epochMs: row.epoch_ms, fetchedAt: row.fetched_at } : null;
}

export async function saveElements(env: Env, omm: OmmElements, now: number): Promise<void> {
  await env.DB.prepare(
    "INSERT INTO elements (norad_id, omm_json, epoch_ms, fetched_at) VALUES (?1, ?2, ?3, ?4) " +
      "ON CONFLICT (norad_id) DO UPDATE SET omm_json = ?2, epoch_ms = ?3, fetched_at = ?4",
  )
    .bind(omm.NORAD_CAT_ID, JSON.stringify(omm), ommEpochMs(omm), now)
    .run();
}

/**
 * Baixa os elementos do CelesTrak. Regras da política de uso deles:
 * um download por ciclo (o cron roda 2x/dia) e, em QUALQUER resposta diferente de 200,
 * parar e avisar um humano. Por isso aqui não há nova tentativa.
 */
export async function fetchElementsFromCelestrak(
  noradId: number,
): Promise<{ ok: true; omm: OmmElements } | { ok: false; status: number; detail: string }> {
  let res: Response;
  try {
    res = await fetch(`${CELESTRAK_URL}?CATNR=${noradId}&FORMAT=json`, {
      headers: { "User-Agent": "ceu-de-sao-paulo (github.com/joaosoup/ceu-de-sao-paulo)", "Accept-Encoding": "gzip" },
    });
  } catch (err) {
    return { ok: false, status: 0, detail: String(err) };
  }
  if (res.status !== 200) return { ok: false, status: res.status, detail: (await res.text()).slice(0, 200) };
  const data: unknown = await res.json().catch(() => null);
  const first = Array.isArray(data) ? data[0] : null;
  if (!isValidOmm(first) || first.NORAD_CAT_ID !== noradId) return { ok: false, status: 200, detail: "resposta sem elementos válidos" };
  return { ok: true, omm: first };
}
