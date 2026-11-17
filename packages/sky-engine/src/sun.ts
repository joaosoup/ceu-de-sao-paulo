import * as Astronomy from "astronomy-engine";
import type { ObserverLocation } from "./types.js";

export const AU_KM = 149_597_870.7;
export const EARTH_RADIUS_KM = 6378.137;

export function toAstroObserver(o: ObserverLocation): Astronomy.Observer {
  return new Astronomy.Observer(o.latitude, o.longitude, o.altitudeMeters ?? 0);
}

/** Altura de um corpo acima do horizonte, em graus, com refração. */
export function bodyAltitude(body: Astronomy.Body, date: Date, observer: Astronomy.Observer): number {
  const eq = Astronomy.Equator(body, date, observer, true, true);
  return Astronomy.Horizon(date, observer, eq.ra, eq.dec, "normal").altitude;
}

export function sunAltitude(date: Date, observer: Astronomy.Observer): number {
  return bodyAltitude(Astronomy.Body.Sun, date, observer);
}

/** Vetor geocêntrico do Sol em km (J2000; a diferença para TEME é desprezível aqui). */
export function sunVectorKm(date: Date): { x: number; y: number; z: number } {
  const v = Astronomy.GeoVector(Astronomy.Body.Sun, date, false);
  return { x: v.x * AU_KM, y: v.y * AU_KM, z: v.z * AU_KM };
}

/**
 * O satélite está iluminado pelo Sol? Modelo de sombra cilíndrica da Terra:
 * suficiente para a olho nu (a penumbra dura poucos segundos em órbita baixa).
 */
export function isSunlit(
  satEciKm: { x: number; y: number; z: number },
  sunKm: { x: number; y: number; z: number },
): boolean {
  const sunNorm = Math.hypot(sunKm.x, sunKm.y, sunKm.z);
  const along = (satEciKm.x * sunKm.x + satEciKm.y * sunKm.y + satEciKm.z * sunKm.z) / sunNorm;
  if (along > 0) return true; // lado diurno
  const r2 = satEciKm.x ** 2 + satEciKm.y ** 2 + satEciKm.z ** 2;
  return Math.sqrt(Math.max(0, r2 - along * along)) > EARTH_RADIUS_KM;
}
