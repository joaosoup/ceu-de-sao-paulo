import { describe, expect, it } from "vitest";
import {
  GRANDE_SP_BOUNDS, brightnessScore, cellCenter, cellIdFor, cellsInBounds, classify, compassDirection,
  describeElevation, durationScore, elevationScore, observationIndex, passGeometryScore, skyFactor,
} from "../src/index.js";

describe("células", () => {
  it("o centro da célula cai na mesma célula e a menos de meia célula do ponto", () => {
    const id = cellIdFor(-23.5505, -46.6333);
    const c = cellCenter(id);
    expect(cellIdFor(c.latitude, c.longitude)).toBe(id);
    expect(Math.abs(c.latitude + 23.5505)).toBeLessThanOrEqual(0.125);
    expect(Math.abs(c.longitude + 46.6333)).toBeLessThanOrEqual(0.125);
  });
  it("pontos vizinhos na mesma célula têm o mesmo id; rejeita coordenada inválida", () => {
    expect(cellIdFor(-23.55, -46.63)).toBe(cellIdFor(-23.56, -46.64));
    expect(() => cellIdFor(91, 0)).toThrow();
    expect(() => cellCenter("abc")).toThrow();
  });
  it("a grade da Grande São Paulo é pequena e contém a capital", () => {
    const b = GRANDE_SP_BOUNDS;
    const cells = cellsInBounds(b.south, b.west, b.north, b.east);
    expect(cells).toContain(cellIdFor(-23.5505, -46.6333));
    expect(cells.length).toBeGreaterThan(10);
    expect(cells.length).toBeLessThan(60);
  });
});

describe("índice de observação", () => {
  it("notas nos pontos de referência do plano", () => {
    expect(brightnessScore(-3.5)).toBe(100);
    expect(brightnessScore(0)).toBe(25);
    expect(brightnessScore(2)).toBe(0);
    expect(elevationScore(60)).toBe(100);
    expect(elevationScore(25)).toBe(50);
    expect(elevationScore(10)).toBe(0);
    expect(durationScore(240)).toBe(100);
    expect(durationScore(120)).toBe(50);
  });
  it("passagem ótima com céu limpo é excelente; nuvens baixas derrubam", () => {
    const g = passGeometryScore({ magnitude: -3.4, peak: { time: new Date(), azimuth: 0, elevation: 70 }, durationSeconds: 300 });
    expect(g).toBeCloseTo(100, 5);
    expect(classify(observationIndex(g, { low: 0, mid: 0, high: 0 }))).toBe("excelente");
    expect(classify(observationIndex(g, { low: 0, mid: 0, high: 1 }))).toBe("excelente"); // cirros: ainda dá
    expect(classify(observationIndex(g, { low: 0.9, mid: 0, high: 0 }))).toBe("oculta");
    expect(observationIndex(g, null)).toBe(100);
  });
  it("fator de céu fica entre 0 e 1", () => {
    expect(skyFactor({ low: 1, mid: 1, high: 1 })).toBe(0);
    expect(skyFactor({ low: 0, mid: 0, high: 0 })).toBe(1);
  });
  it("limites de classe", () => {
    expect(classify(70)).toBe("excelente");
    expect(classify(69)).toBe("boa");
    expect(classify(49)).toBe("dificil");
    expect(classify(29)).toBe("oculta");
  });
});

describe("linguagem", () => {
  it("direções e alturas em português", () => {
    expect(compassDirection(0)).toBe("norte");
    expect(compassDirection(315)).toBe("noroeste");
    expect(compassDirection(359)).toBe("norte");
    expect(compassDirection(-90)).toBe("oeste");
    expect(describeElevation(80)).toBe("quase no topo do céu");
    expect(describeElevation(35)).toBe("a meia altura");
  });
});
