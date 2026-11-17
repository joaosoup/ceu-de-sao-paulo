const TZ = 'America/Sao_Paulo';
const timeFmt = new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });
const dayFmt = new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long' });
const shortDayFmt = new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, weekday: 'short', day: '2-digit', month: '2-digit' });
const ymdFmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ });

/** "19h42" */
export function hhmm(ms: number): string {
  const [h, m] = timeFmt.format(ms).split(':');
  return `${Number(h)}h${m}`;
}
export const longDay = (ms: number) => dayFmt.format(ms);
export const shortDay = (ms: number) => shortDayFmt.format(ms).replace('.', '');
export const ymd = (ms: number) => ymdFmt.format(ms);

/** "hoje", "amanhã" ou "quinta-feira, 19 de novembro" */
export function relativeDay(ms: number, now: number): string {
  const d = ymd(ms);
  if (d === ymd(now)) return 'hoje';
  if (d === ymd(now + 86_400_000)) return 'amanhã';
  return longDay(ms);
}

/** "em 2 h 14 min", "em 8 min", "agora" */
export function countdown(ms: number, now: number): string {
  const min = Math.round((ms - now) / 60_000);
  if (min <= 0) return 'agora';
  if (min < 60) return `em ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `em ${h} h ${String(min % 60).padStart(2, '0')} min`;
  const days = Math.floor(h / 24);
  return days === 1 ? 'em 1 dia' : `em ${days} dias`;
}

export function period(ms: number): string {
  const h = Number(timeFmt.format(ms).split(':')[0]);
  if (h < 5) return 'de madrugada';
  if (h < 12) return 'de manhã, antes do sol nascer';
  if (h < 18) return 'à tarde';
  return 'à noite';
}

export const pct = (x: number) => `${Math.round(x * 100)}%`;
