import { cellCenter, type CloudCover } from "@ceu/sky-engine";
import type { Env } from "./env.js";
import { HOUR_MS } from "./time.js";

/** Trocar de provedor (ex.: MET Norway) é implementar esta interface. */
export interface WeatherProvider {
  /** Nuvens por camada para as próximas horas. Chave: hora UTC desde a época. */
  hourlyClouds(latitude: number, longitude: number): Promise<Map<number, CloudCover>>;
}

/**
 * Open-Meteo: gratuito só para uso NÃO comercial (anúncio ou assinatura = comercial),
 * atribuição CC BY 4.0 obrigatória (está no rodapé da PWA). Limite por IP.
 */
export const openMeteo: WeatherProvider = {
  async hourlyClouds(latitude, longitude) {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude.toFixed(3)}&longitude=${longitude.toFixed(3)}` +
      "&hourly=cloud_cover_low,cloud_cover_mid,cloud_cover_high&forecast_days=2&timeformat=unixtime&timezone=UTC";
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Open-Meteo respondeu ${res.status}`);
    return parseOpenMeteo(await res.json());
  },
};

export function parseOpenMeteo(data: unknown): Map<number, CloudCover> {
  const h = (data as { hourly?: Record<string, unknown> } | null)?.hourly;
  const time = h?.time, low = h?.cloud_cover_low, mid = h?.cloud_cover_mid, high = h?.cloud_cover_high;
  if (!Array.isArray(time) || !Array.isArray(low) || !Array.isArray(mid) || !Array.isArray(high)) {
    throw new Error("Resposta do Open-Meteo em formato inesperado");
  }
  const out = new Map<number, CloudCover>();
  const frac = (v: unknown) => Math.min(1, Math.max(0, Number(v) / 100));
  time.forEach((t, i) => {
    if (typeof t !== "number" || [low[i], mid[i], high[i]].some((v) => typeof v !== "number")) return;
    out.set(Math.floor((t * 1000) / HOUR_MS), { low: frac(low[i]), mid: frac(mid[i]), high: frac(high[i]) });
  });
  return out;
}

/** Nuvens da célula na hora do evento: do cache ou de UMA chamada por célula (nunca por usuário). */
export async function cloudsFor(env: Env, cellId: string, atMs: number, now: number, provider: WeatherProvider = openMeteo): Promise<CloudCover | null> {
  const hour = Math.floor(atMs / HOUR_MS);
  const cached = await env.DB.prepare("SELECT low, mid, high FROM weather_cache WHERE cell_id = ? AND hour = ? AND fetched_at > ?")
    .bind(cellId, hour, now - HOUR_MS)
    .first<CloudCover>();
  if (cached) return cached;
  try {
    const c = cellCenter(cellId);
    const hours = await provider.hourlyClouds(c.latitude, c.longitude);
    const stmts = [...hours].filter(([h]) => h >= hour - 1 && h <= hour + 6).map(([h, v]) =>
      env.DB.prepare(
        "INSERT INTO weather_cache (cell_id, hour, low, mid, high, fetched_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6) " +
          "ON CONFLICT (cell_id, hour) DO UPDATE SET low = ?3, mid = ?4, high = ?5, fetched_at = ?6",
      ).bind(cellId, h, v.low, v.mid, v.high, now),
    );
    if (stmts.length) await env.DB.batch(stmts);
    return hours.get(hour) ?? null;
  } catch (err) {
    console.warn(`previsão indisponível para ${cellId}: ${String(err)}`);
    return null;
  }
}
