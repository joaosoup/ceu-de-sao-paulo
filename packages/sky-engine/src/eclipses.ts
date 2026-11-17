import * as Astronomy from "astronomy-engine";
import type { ObserverLocation } from "./types.js";
import { bodyAltitude, toAstroObserver } from "./sun.js";

export interface LocalSolarEclipse {
  kind: "parcial" | "anular" | "total";
  partialBegin: Date;
  peak: Date;
  partialEnd: Date;
  /** Fração do disco solar encoberta no máximo, de 0 a 1. */
  obscuration: number;
  /** Altura do Sol no máximo, em graus. Negativa = máximo abaixo do horizonte. */
  sunAltitudeAtPeak: number;
  /** Sempre true: qualquer tela que mostre este evento precisa do aviso de proteção ocular. */
  requiresEyeProtection: true;
}

const SOLAR_KIND = { partial: "parcial", annular: "anular", total: "total" } as const;

/** Eclipses solares vistos DESTE local entre `from` e `to`, com o Sol acima do horizonte em algum momento. */
export function localSolarEclipses(location: ObserverLocation, from: Date, to: Date): LocalSolarEclipse[] {
  const obs = toAstroObserver(location);
  const out: LocalSolarEclipse[] = [];
  let e = Astronomy.SearchLocalSolarEclipse(from, obs);
  while (e.peak.time.date < to) {
    const visible = e.partial_begin.altitude > 0 || e.peak.altitude > 0 || e.partial_end.altitude > 0;
    if (visible) {
      out.push({
        kind: SOLAR_KIND[e.kind as keyof typeof SOLAR_KIND] ?? "parcial",
        partialBegin: e.partial_begin.time.date,
        peak: e.peak.time.date,
        partialEnd: e.partial_end.time.date,
        obscuration: e.obscuration,
        sunAltitudeAtPeak: e.peak.altitude,
        requiresEyeProtection: true,
      });
    }
    e = Astronomy.NextLocalSolarEclipse(e.peak.time, obs);
  }
  return out;
}

export interface LocalLunarEclipse {
  kind: "penumbral" | "parcial" | "total";
  peak: Date;
  /** Fração do disco lunar dentro da umbra no máximo, de 0 a 1. */
  obscuration: number;
  /** Altura da Lua no máximo. Abaixo de 0 o máximo não é visível deste local. */
  moonAltitudeAtPeak: number;
  visibleAtPeak: boolean;
}

const LUNAR_KIND = { penumbral: "penumbral", partial: "parcial", total: "total" } as const;

export function lunarEclipses(location: ObserverLocation, from: Date, to: Date): LocalLunarEclipse[] {
  const obs = toAstroObserver(location);
  const out: LocalLunarEclipse[] = [];
  let e = Astronomy.SearchLunarEclipse(from);
  while (e.peak.date < to) {
    const alt = bodyAltitude(Astronomy.Body.Moon, e.peak.date, obs);
    out.push({
      kind: LUNAR_KIND[e.kind as keyof typeof LUNAR_KIND] ?? "penumbral",
      peak: e.peak.date,
      obscuration: e.obscuration,
      moonAltitudeAtPeak: alt,
      visibleAtPeak: alt > 0,
    });
    e = Astronomy.NextLunarEclipse(e.peak);
  }
  return out;
}
