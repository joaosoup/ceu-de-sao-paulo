export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  PRECOMPUTE_QUEUE: Queue<PrecomputeTask>;
  SEND_QUEUE: Queue<SendTask>;
  VAPID_PRIVATE_KEY: string; // JWK em JSON
  VAPID_PUBLIC_KEY: string;
  VAPID_SUBJECT: string;
  ADMIN_TOKEN: string;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
}

export type PrecomputeTask =
  | { t: "pass"; cell: string; dayStart: number; norad: number }
  | { t: "eclipse"; cell: string };

export interface SendTask {
  t: "send";
  items: { e: string; s: string }[];
}

export const ISS_NORAD_ID = 25544;
export const HORIZON_DAYS = 10;
export const MAX_ELEMENTS_AGE_H = 48;
export const ALERT_AGE_WARNING_H = 36;
export const DEFAULT_ALERT_INDEX = 50;
/** Sem previsão de nuvens, só geometria excelente gera alerta. */
export const NO_WEATHER_MIN_GEOMETRY = 70;
export const SEND_BATCH = 6;
