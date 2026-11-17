import * as Astronomy from "astronomy-engine";
import type { ObserverLocation } from "./types.js";
import { bodyAltitude, toAstroObserver } from "./sun.js";

export type MoonQuarterName = "nova" | "crescente" | "cheia" | "minguante";
const QUARTER_NAMES: readonly MoonQuarterName[] = ["nova", "crescente", "cheia", "minguante"];

export interface MoonQuarterEvent {
  quarter: MoonQuarterName;
  time: Date;
}

/** Próximas fases principais da Lua a partir de `from`. */
export function nextMoonQuarters(from: Date, count: number): MoonQuarterEvent[] {
  const out: MoonQuarterEvent[] = [];
  let mq = Astronomy.SearchMoonQuarter(from);
  for (let i = 0; i < count; i++) {
    out.push({ quarter: QUARTER_NAMES[mq.quarter] ?? "nova", time: mq.time.date });
    mq = Astronomy.NextMoonQuarter(mq);
  }
  return out;
}

/** Fração iluminada do disco lunar, de 0 a 1. */
export function moonIlluminatedFraction(date: Date): number {
  return Astronomy.Illumination(Astronomy.Body.Moon, date).phase_fraction;
}

export interface MoonRiseSet {
  rise: Date | null;
  set: Date | null;
}

/** Próximo nascer e pôr da Lua em até 1 dia a partir de `from`. */
export function moonRiseSet(location: ObserverLocation, from: Date): MoonRiseSet {
  const obs = toAstroObserver(location);
  const rise = Astronomy.SearchRiseSet(Astronomy.Body.Moon, obs, +1, from, 1);
  const set = Astronomy.SearchRiseSet(Astronomy.Body.Moon, obs, -1, from, 1);
  return { rise: rise?.date ?? null, set: set?.date ?? null };
}

export function moonAltitude(location: ObserverLocation, date: Date): number {
  return bodyAltitude(Astronomy.Body.Moon, date, toAstroObserver(location));
}
