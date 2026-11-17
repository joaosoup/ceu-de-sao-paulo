import type { ObserverLocation } from "./types.js";

/**
 * Grade de células geográficas. O aparelho arredonda a posição para a célula
 * e o servidor só conhece o id dela — nunca a coordenada exata.
 * Tamanho padrão: 0,25° (~28 km). É hipótese a validar (ver ADR 0002).
 */
export const DEFAULT_CELL_SIZE_DEG = 0.25;

export function cellIdFor(
  latitude: number,
  longitude: number,
  sizeDeg = DEFAULT_CELL_SIZE_DEG,
): string {
  if (!(latitude >= -90 && latitude <= 90) || !(longitude >= -180 && longitude <= 180)) {
    throw new RangeError("Coordenada fora do intervalo válido");
  }
  const row = Math.floor((latitude + 90) / sizeDeg);
  const col = Math.floor((longitude + 180) / sizeDeg);
  return `${sizeDeg}:${row}:${col}`;
}

/** Centro da célula, usado como "observador" no pré-cálculo. */
export function cellCenter(cellId: string): ObserverLocation {
  const parts = cellId.split(":");
  const size = Number(parts[0]);
  const row = Number(parts[1]);
  const col = Number(parts[2]);
  if (parts.length !== 3 || !(size > 0) || !Number.isInteger(row) || !Number.isInteger(col)) {
    throw new Error(`Id de célula inválido: ${cellId}`);
  }
  return {
    latitude: (row + 0.5) * size - 90,
    longitude: (col + 0.5) * size - 180,
  };
}

/** Células que cobrem um retângulo (para a grade fixa da Grande São Paulo). */
export function cellsInBounds(
  south: number,
  west: number,
  north: number,
  east: number,
  sizeDeg = DEFAULT_CELL_SIZE_DEG,
): string[] {
  const ids = new Set<string>();
  for (let lat = south; lat < north + sizeDeg; lat += sizeDeg) {
    for (let lon = west; lon < east + sizeDeg; lon += sizeDeg) {
      ids.add(cellIdFor(Math.min(lat, north), Math.min(lon, east), sizeDeg));
    }
  }
  return [...ids];
}

/** Retângulo aproximado da Região Metropolitana de São Paulo. */
export const GRANDE_SP_BOUNDS = { south: -24.1, west: -47.25, north: -23.15, east: -45.65 };
