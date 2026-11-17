import { describe, expect, it } from "vitest";
import { localSolarEclipses, lunarEclipses, moonIlluminatedFraction, nextMoonQuarters } from "../src/index.js";
import { SAO_PAULO } from "./fixtures.js";

const minutes = (a: Date, iso: string) => Math.abs(a.getTime() - Date.parse(iso)) / 60_000;

describe("eclipses (casos de referência reais)", () => {
  it("eclipse solar de 06/02/2027 em São Paulo: parcial, 78% às 13h21 (BRT)", () => {
    // conferido com fonte independente (Orbital Radar): 78%, máximo 13:21 GMT-3, Sol a 74°
    const [e] = localSolarEclipses(SAO_PAULO, new Date("2027-01-01T00:00:00Z"), new Date("2027-12-31T00:00:00Z"));
    expect(e).toBeDefined();
    expect(e!.kind).toBe("parcial");
    expect(minutes(e!.peak, "2027-02-06T16:21:00Z")).toBeLessThan(1);
    expect(e!.obscuration).toBeGreaterThan(0.77);
    expect(e!.obscuration).toBeLessThan(0.79);
    expect(e!.sunAltitudeAtPeak).toBeGreaterThan(72);
    expect(e!.requiresEyeProtection).toBe(true);
    expect(e!.partialBegin.getTime()).toBeLessThan(e!.peak.getTime());
  });

  it("eclipse lunar total de 31/12/2028 existe, mas o máximo não é visível de SP", () => {
    const list = lunarEclipses(SAO_PAULO, new Date("2028-07-01T00:00:00Z"), new Date("2029-01-02T00:00:00Z"));
    const total = list.find((x) => x.kind === "total");
    expect(total).toBeDefined();
    expect(total!.visibleAtPeak).toBe(false);
  });
});

describe("Lua", () => {
  it("Lua cheia de 24/11/2026 por volta de 11h54 (BRT)", () => {
    const quarters = nextMoonQuarters(new Date("2026-11-17T00:00:00Z"), 4);
    const full = quarters.find((q) => q.quarter === "cheia");
    expect(full).toBeDefined();
    expect(minutes(full!.time, "2026-11-24T14:54:00Z")).toBeLessThan(2);
    expect(moonIlluminatedFraction(full!.time)).toBeGreaterThan(0.99);
  });
});
