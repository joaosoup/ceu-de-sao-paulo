/** MVP: só Grande São Paulo, que não tem horário de verão. UTC-3 fixo. */
export const TZ_OFFSET_MS = -3 * 3_600_000;
export const DAY_MS = 86_400_000;
export const HOUR_MS = 3_600_000;
export const MIN_MS = 60_000;

export function localHour(ms: number): number {
  return new Date(ms + TZ_OFFSET_MS).getUTCHours();
}

/** Madrugada pertence à noite que começou no dia anterior: 02h de 17/11 -> "2026-11-16". */
export function nightKey(ms: number): string {
  return new Date(ms + TZ_OFFSET_MS - 12 * HOUR_MS).toISOString().slice(0, 10);
}

/** Horário de silêncio padrão: das 23h às 6h. */
export function isQuietHour(ms: number): boolean {
  const h = localHour(ms);
  return h >= 23 || h < 6;
}

/** Início (em UTC ms) do dia local que contém `ms`. */
export function localDayStart(ms: number): number {
  return Math.floor((ms + TZ_OFFSET_MS) / DAY_MS) * DAY_MS - TZ_OFFSET_MS;
}

export function formatLocalTime(ms: number): string {
  const d = new Date(ms + TZ_OFFSET_MS);
  return `${d.getUTCHours()}h${String(d.getUTCMinutes()).padStart(2, "0")}`;
}
