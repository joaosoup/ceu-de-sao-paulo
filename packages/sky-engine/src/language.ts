/** Textos em português simples: o usuário não precisa saber o que é azimute. */

const COMPASS = ["norte", "nordeste", "leste", "sudeste", "sul", "sudoeste", "oeste", "noroeste"] as const;

export function compassDirection(azimuthDeg: number): (typeof COMPASS)[number] {
  const idx = Math.round((((azimuthDeg % 360) + 360) % 360) / 45) % 8;
  return COMPASS[idx]!;
}

export function describeElevation(elevationDeg: number): string {
  if (elevationDeg >= 75) return "quase no topo do céu";
  if (elevationDeg >= 50) return "bem alto";
  if (elevationDeg >= 30) return "a meia altura";
  if (elevationDeg >= 18) return "baixo, uns dois punhos acima do horizonte";
  return "bem baixo, um punho acima do horizonte";
}

export function describeBrightness(magnitude: number): string {
  if (magnitude <= -3) return "mais brilhante que qualquer estrela";
  if (magnitude <= -1.5) return "tão brilhante quanto Júpiter";
  if (magnitude <= 0) return "como as estrelas mais brilhantes";
  return "fraco, difícil na cidade";
}
