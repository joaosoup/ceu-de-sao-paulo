import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { compassDirection, findVisiblePasses, type OmmElements } from "../src/index.js";
import { SAO_PAULO } from "./fixtures.js";

// Elementos REAIS da ISS (CelesTrak, época 2026-11-16 13:27 UTC).
const [iss] = JSON.parse(
  readFileSync(new URL("./fixtures/iss-2026-11-16.json", import.meta.url), "utf8"),
) as OmmElements[];

// Referência externa: spacenexus.us/tonight/sao-paulo, consultada em 16/11/2026 (época 14:58 UTC).
// A página arredonda para o minuto, então a tolerância aqui é de 60 s e 1°.
// Pendente: conferir 20 passagens ao segundo com o Heavens-Above (critério do plano: 30 s e 2°).
const passes = findVisiblePasses(iss!, SAO_PAULO, { from: new Date("2026-11-17T00:00:00Z"), days: 1 });
const within = (d: Date, iso: string) => Math.abs(d.getTime() - Date.parse(iso)) / 1000;

describe("passagens reais da ISS em São Paulo, madrugada de 17/11/2026", () => {
  it("são duas passagens visíveis", () => {
    expect(passes).toHaveLength(2);
  });

  it("02h51: surge da sombra a 19°, no leste-sudeste, e some abaixo de 10° às 02h52", () => {
    const p = passes[0]!;
    expect(p.startsInShadow).toBe(true);
    expect(within(p.start.time, "2026-11-17T05:51:00Z")).toBeLessThanOrEqual(60);
    expect(within(p.end.time, "2026-11-17T05:52:00Z")).toBeLessThanOrEqual(60);
    expect(Math.abs(p.peak.elevation - 19)).toBeLessThanOrEqual(1);
    expect(p.peak.azimuth).toBeGreaterThan(90);
    expect(p.peak.azimuth).toBeLessThan(135);
    expect(Math.abs(p.magnitude - -0.1)).toBeLessThan(1);
  });

  it("04h25 a 04h27: baixa, máximo de 12° a sudoeste", () => {
    const p = passes[1]!;
    expect(within(p.start.time, "2026-11-17T07:25:00Z")).toBeLessThanOrEqual(60);
    expect(within(p.peak.time, "2026-11-17T07:26:00Z")).toBeLessThanOrEqual(60);
    expect(within(p.end.time, "2026-11-17T07:27:00Z")).toBeLessThanOrEqual(60);
    expect(Math.abs(p.peak.elevation - 12)).toBeLessThanOrEqual(1);
    expect(compassDirection(p.peak.azimuth)).toBe("sudoeste");
  });
});
