import { describe, expect, it } from "vitest";
import { elementsAgeHours, findVisiblePasses, sunAltitude, toAstroObserver } from "../src/index.js";
import { ISS_LIKE_SYNTHETIC, SAO_PAULO } from "./fixtures.js";

const from = new Date("2026-11-16T12:00:00Z");
const passes = findVisiblePasses(ISS_LIKE_SYNTHETIC, SAO_PAULO, { from, days: 60 });

describe("findVisiblePasses (órbita sintética: testa invariantes, não horários reais)", () => {
  it("acha passagens visíveis, mas só uma minoria das passagens", () => {
    expect(passes.length).toBeGreaterThan(10);
    expect(passes.length).toBeLessThan(60); // ~185 passagens acima de 10° no período
  });

  it("todo ponto visível respeita elevação mínima e céu escuro", () => {
    const obs = toAstroObserver(SAO_PAULO);
    for (const p of passes) {
      for (const pt of [p.start, p.peak, p.end]) {
        expect(pt.elevation).toBeGreaterThanOrEqual(10);
        expect(sunAltitude(pt.time, obs)).toBeLessThan(-6);
      }
      expect(p.peak.elevation).toBeGreaterThanOrEqual(p.start.elevation);
      expect(p.peak.elevation).toBeGreaterThanOrEqual(p.end.elevation);
    }
  });

  it("vem em ordem cronológica, com duração coerente e curta", () => {
    for (let i = 0; i < passes.length; i++) {
      const p = passes[i]!;
      expect(p.end.time.getTime()).toBeGreaterThanOrEqual(p.start.time.getTime());
      expect(p.durationSeconds).toBeLessThan(8 * 60);
      if (i > 0) expect(p.start.time.getTime()).toBeGreaterThan(passes[i - 1]!.end.time.getTime());
    }
  });

  it("só acontece perto do anoitecer ou do amanhecer", () => {
    for (const p of passes) expect(p.sunAltitudeAtPeak).toBeGreaterThan(-35);
  });

  it("magnitude estimada fica numa faixa plausível para a ISS", () => {
    for (const p of passes) {
      expect(p.magnitude).toBeGreaterThan(-6);
      expect(p.magnitude).toBeLessThan(3);
    }
  });

  it("respeita elevação mínima mais exigente", () => {
    const high = findVisiblePasses(ISS_LIKE_SYNTHETIC, SAO_PAULO, { from, days: 60, minElevation: 40 });
    expect(high.length).toBeLessThan(passes.length);
    for (const p of high) expect(p.start.elevation).toBeGreaterThanOrEqual(40);
  });

  it("calcula a idade dos elementos", () => {
    expect(elementsAgeHours(passes[0]!.elementsEpoch, new Date("2026-11-18T12:00:00Z"))).toBeCloseTo(48, 5);
  });
});
