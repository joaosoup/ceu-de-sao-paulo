import { classify, compassDirection, describeElevation } from "@ceu/sky-engine";
import type { EclipsePayload, PassPayload } from "./precompute.js";
import { formatLocalTime } from "./time.js";

export interface PushText {
  title: string;
  body: string;
}

function chanceText(index: number, hasWeather: boolean): string {
  if (!hasWeather) return "Sem previsão de nuvens no momento.";
  const c = classify(index);
  return c === "excelente" ? "Chance ótima de céu aberto." : c === "boa" ? "Chance boa de céu aberto." : "Céu incerto.";
}

/** Texto do alerta. Fala em chance, nunca em garantia. */
export function buildPushText(
  payload: PassPayload | EclipsePayload,
  startsAt: number,
  peakAt: number,
  index: number,
  hasWeather: boolean,
): PushText {
  if (payload.kind === "solar_eclipse") {
    const pct = Math.round(payload.obscuration * 100);
    return {
      title: `Eclipse solar hoje, máximo às ${formatLocalTime(peakAt)}`,
      body: `A Lua vai cobrir ${pct}% do Sol. NUNCA olhe para o Sol sem óculos próprios para eclipse. ${chanceText(index, hasWeather)}`,
    };
  }
  const minutes = Math.max(1, Math.round(payload.durationSeconds / 60));
  const where = payload.startsInShadow
    ? `Surge a ${compassDirection(payload.start.az)}, ${describeElevation(payload.start.el)}`
    : `Aparece a ${compassDirection(payload.start.az)} e sobe até ficar ${describeElevation(payload.peak.el)}`;
  return {
    title: `${payload.objectName} às ${formatLocalTime(startsAt)}`,
    body: `${where}. Visível por ${minutes} min. ${chanceText(index, hasWeather)}`,
  };
}
