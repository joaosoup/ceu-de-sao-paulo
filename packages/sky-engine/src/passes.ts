import * as satellite from "satellite.js";
import type { ObserverLocation, OmmElements, PassSearchOptions, SkyPoint, VisiblePass } from "./types.js";
import { isSunlit, sunAltitude, sunVectorKm, toAstroObserver } from "./sun.js";

const COARSE_STEP_MS = 60_000;
const FINE_STEP_MS = 5_000;
const COARSE_PEAK_MARGIN_DEG = 5;
const DEG = 180 / Math.PI;

interface Sample extends SkyPoint {
  rangeKm: number;
  eci: { x: number; y: number; z: number };
}

/**
 * Passagens VISÍVEIS a olho nu de um satélite para um observador.
 * Uma passagem só entra quando, ao mesmo tempo:
 *   1. o satélite está acima de `minElevation`;
 *   2. o Sol está abaixo de `maxSunAltitude` no local (céu escuro);
 *   3. o satélite está fora da sombra da Terra (iluminado).
 * Nuvens ficam fora daqui: entram no índice de observação, perto da hora.
 */
export function findVisiblePasses(
  omm: OmmElements,
  location: ObserverLocation,
  options: PassSearchOptions,
): VisiblePass[] {
  const minElevation = options.minElevation ?? 10;
  const maxSunAltitude = options.maxSunAltitude ?? -6;
  const standardMagnitude = options.standardMagnitude ?? -1.8;

  const satrec = satellite.json2satrec(omm as unknown as Parameters<typeof satellite.json2satrec>[0]);
  const observerGd = {
    latitude: location.latitude / DEG,
    longitude: location.longitude / DEG,
    height: (location.altitudeMeters ?? 0) / 1000,
  };
  const astroObserver = toAstroObserver(location);
  const elementsEpoch = new Date(omm.EPOCH.endsWith("Z") ? omm.EPOCH : `${omm.EPOCH}Z`);

  const sample = (ms: number): Sample | null => {
    const time = new Date(ms);
    const pv = satellite.propagate(satrec, time);
    const position = pv?.position;
    if (!position || typeof position === "boolean") return null;
    const ecf = satellite.eciToEcf(position, satellite.gstime(time));
    const look = satellite.ecfToLookAngles(observerGd, ecf);
    return {
      time,
      azimuth: (look.azimuth * DEG + 360) % 360,
      elevation: look.elevation * DEG,
      rangeKm: look.rangeSat,
      eci: position,
    };
  };

  const startMs = options.from.getTime();
  const endMs = startMs + options.days * 86_400_000;
  const passes: VisiblePass[] = [];

  // Varredura grossa: acha janelas acima do horizonte. Fina: só dentro delas.
  let windowStart: number | null = null;
  let coarseMax = -90;
  for (let ms = startMs; ms <= endMs + COARSE_STEP_MS; ms += COARSE_STEP_MS) {
    const s = ms <= endMs ? sample(ms) : null;
    const above = s !== null && s.elevation > 0;
    if (above) {
      if (windowStart === null) {
        windowStart = ms - COARSE_STEP_MS;
        coarseMax = -90;
      }
      coarseMax = Math.max(coarseMax, s.elevation);
    } else if (windowStart !== null) {
      // a amostragem grossa pode perder o pico por alguns graus: margem de 5°
      if (coarseMax >= minElevation - COARSE_PEAK_MARGIN_DEG) {
        const pass = refineWindow(windowStart, ms);
        if (pass) passes.push(pass);
      }
      windowStart = null;
    }
  }
  return passes;

  function refineWindow(fromMs: number, toMs: number): VisiblePass | null {
    // O Sol quase não se move durante uma passagem (minutos): calcula nas pontas e interpola.
    // Isso evita a parte mais cara do cálculo e mantém o custo por execução baixo.
    const sunAltFrom = sunAltitude(new Date(fromMs), astroObserver);
    const sunAltTo = sunAltitude(new Date(toMs), astroObserver);
    if (Math.min(sunAltFrom, sunAltTo) >= maxSunAltitude) return null; // dia claro a passagem inteira
    const sunAltAt = (ms: number) => sunAltFrom + ((ms - fromMs) / (toMs - fromMs)) * (sunAltTo - sunAltFrom);
    const sunVec = sunVectorKm(new Date((fromMs + toMs) / 2));
    const visible: Sample[] = [];
    let anyAboveBeforeVisible = false;
    let anyAboveAfterVisible = false;
    for (let ms = fromMs; ms <= toMs; ms += FINE_STEP_MS) {
      const s = sample(ms);
      if (!s || s.elevation < minElevation) continue;
      const lit = isSunlit(s.eci, sunVec);
      const dark = sunAltAt(ms) < maxSunAltitude;
      if (lit && dark) {
        // só o primeiro trecho contínuo conta (um satélite não "volta" numa passagem)
        if (anyAboveAfterVisible) break;
        visible.push(s);
      } else if (visible.length === 0) {
        if (!lit) anyAboveBeforeVisible = true;
      } else {
        if (!lit) anyAboveAfterVisible = true;
        else break; // ficou claro demais: fim do trecho visível
      }
    }
    const first = visible[0];
    const last = visible[visible.length - 1];
    if (!first || !last) return null;
    const peak = visible.reduce((a, b) => (b.elevation > a.elevation ? b : a));
    const toPoint = (s: Sample): SkyPoint => ({ time: s.time, azimuth: s.azimuth, elevation: s.elevation });
    return {
      noradId: omm.NORAD_CAT_ID,
      objectName: omm.OBJECT_NAME,
      start: toPoint(first),
      peak: toPoint(peak),
      end: toPoint(last),
      durationSeconds: Math.round((last.time.getTime() - first.time.getTime()) / 1000),
      magnitude: estimateMagnitude(peak, standardMagnitude),
      startsInShadow: anyAboveBeforeVisible,
      endsInShadow: anyAboveAfterVisible,
      sunAltitudeAtPeak: sunAltitude(peak.time, astroObserver),
      elementsEpoch,
    };
  }

  function estimateMagnitude(s: Sample, stdMag: number): number {
    // posição do observador em ECI = satélite - vetor de visada; aqui basta o ângulo de fase
    const sun = sunVectorKm(s.time);
    const obsEci = satellite.ecfToEci(satellite.geodeticToEcf(observerGd), satellite.gstime(s.time));
    const toObs = { x: obsEci.x - s.eci.x, y: obsEci.y - s.eci.y, z: obsEci.z - s.eci.z };
    const toSun = { x: sun.x - s.eci.x, y: sun.y - s.eci.y, z: sun.z - s.eci.z };
    const cos =
      (toObs.x * toSun.x + toObs.y * toSun.y + toObs.z * toSun.z) /
      (Math.hypot(toObs.x, toObs.y, toObs.z) * Math.hypot(toSun.x, toSun.y, toSun.z));
    const phase = Math.acos(Math.max(-1, Math.min(1, cos)));
    const illuminated = Math.max((1 + Math.cos(phase)) / 2, 0.01);
    return stdMag + 5 * Math.log10(s.rangeKm / 1000) - 2.5 * Math.log10(illuminated / 0.5);
  }
}

/** Idade dos elementos em horas. Acima de 48 h, o plano manda não alertar. */
export function elementsAgeHours(elementsEpoch: Date, now: Date): number {
  return (now.getTime() - elementsEpoch.getTime()) / 3_600_000;
}
