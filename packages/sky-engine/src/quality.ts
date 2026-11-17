import type { CloudCover, QualityClass, VisiblePass } from "./types.js";

/**
 * Índice de observação (0 a 100) = nota geométrica x fator de céu.
 * TODOS os pesos e limites aqui são hipóteses iniciais do plano (seção 8),
 * a calibrar com o feedback "vi / não vi". Mude aqui, não espalhe números pelo código.
 */
export const QUALITY_WEIGHTS = {
  brightness: 0.45,
  elevation: 0.4,
  duration: 0.15,
  cloudLow: 1.0,
  cloudMid: 0.8,
  cloudHigh: 0.3,
} as const;

export const QUALITY_THRESHOLDS = { excelente: 70, boa: 50, dificil: 30 } as const;

/** Interpolação linear por trechos entre pontos (x crescente), com saturação nas pontas. */
function piecewise(x: number, points: readonly (readonly [number, number])[]): number {
  const first = points[0]!;
  const last = points[points.length - 1]!;
  if (x <= first[0]) return first[1];
  if (x >= last[0]) return last[1];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    if (x <= b[0]) return a[1] + ((x - a[0]) / (b[0] - a[0])) * (b[1] - a[1]);
  }
  return last[1];
}

export function brightnessScore(magnitude: number): number {
  return piecewise(magnitude, [[-3, 100], [0, 25], [1, 0]]);
}

export function elevationScore(maxElevationDeg: number): number {
  return piecewise(maxElevationDeg, [[10, 0], [25, 50], [60, 100]]);
}

export function durationScore(seconds: number): number {
  return piecewise(seconds, [[0, 0], [120, 50], [240, 100]]);
}

/** Nota geométrica de uma passagem: conhecida com dias de antecedência. */
export function passGeometryScore(pass: Pick<VisiblePass, "magnitude" | "peak" | "durationSeconds">): number {
  const w = QUALITY_WEIGHTS;
  return (
    w.brightness * brightnessScore(pass.magnitude) +
    w.elevation * elevationScore(pass.peak.elevation) +
    w.duration * durationScore(pass.durationSeconds)
  );
}

/** Fator de céu (0 a 1): nuvens baixas tapam tudo, altas e finas deixam passar algo brilhante. */
export function skyFactor(clouds: CloudCover): number {
  const w = QUALITY_WEIGHTS;
  const blocked = w.cloudLow * clouds.low + w.cloudMid * clouds.mid + w.cloudHigh * clouds.high;
  return Math.max(0, 1 - Math.min(1, blocked));
}

export function observationIndex(geometryScore: number, clouds: CloudCover | null): number {
  // sem previsão de nuvens, o índice é só geométrico; quem chama decide o que fazer (seção 6)
  return Math.round(geometryScore * (clouds ? skyFactor(clouds) : 1));
}

export function classify(index: number): QualityClass {
  if (index >= QUALITY_THRESHOLDS.excelente) return "excelente";
  if (index >= QUALITY_THRESHOLDS.boa) return "boa";
  if (index >= QUALITY_THRESHOLDS.dificil) return "dificil";
  return "oculta";
}
