import type { Env } from "./env.js";

/** Aviso operacional para o dono do projeto, via bot do Telegram (opcional). */
export async function notifyOperator(env: Env, text: string): Promise<void> {
  console.warn(`[operador] ${text}`);
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) return;
  try {
    await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text: `Céu de SP: ${text}` }),
    });
  } catch {
    // aviso é melhor esforço; não derruba o cron
  }
}
