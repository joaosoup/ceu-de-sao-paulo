import { GRANDE_SP_BOUNDS, cellsInBounds } from "@ceu/sky-engine";

/** Grade FIXA do MVP: calculada inteira, haja inscrito ou não, para não revelar onde há gente. */
const b = GRANDE_SP_BOUNDS;
export const GRID_CELLS: readonly string[] = cellsInBounds(b.south, b.west, b.north, b.east);
const GRID_SET = new Set(GRID_CELLS);

export function isGridCell(cellId: string): boolean {
  return GRID_SET.has(cellId);
}
