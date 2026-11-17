import { describe, expect, it } from "vitest";
import { isAllowedPushEndpoint, normalizePrefs } from "../src/api.js";
import { decide } from "../src/decide.js";
import { GRID_CELLS, isGridCell } from "../src/grid.js";
import { buildPushText } from "../src/messages.js";
import { formatLocalTime, isQuietHour, localDayStart, nightKey } from "../src/time.js";
import { parseOpenMeteo } from "../src/weather.js";
import { cellIdFor } from "@ceu/sky-engine";

const clear = { low: 0, mid: 0, high: 0 };

describe("decisão de alerta", () => {
  it("geometria boa + céu limpo = alerta", () => {
    expect(decide(80, clear, 10)).toMatchObject({ decision: "alert", index: 80, reason: null });
  });
  it("nuvens baixas derrubam e o motivo é 'nuvens'", () => {
    expect(decide(80, { low: 0.9, mid: 0, high: 0 }, 10)).toMatchObject({ decision: "skip", reason: "nuvens" });
  });
  it("geometria fraca não alerta nem com céu limpo", () => {
    expect(decide(32, clear, 10)).toMatchObject({ decision: "skip", reason: "geometria_fraca" });
  });
  it("elementos com mais de 48 h bloqueiam o alerta", () => {
    expect(decide(95, clear, 49)).toMatchObject({ decision: "skip", reason: "elementos_velhos" });
  });
  it("sem previsão: só geometria excelente passa", () => {
    expect(decide(75, null, 10)).toMatchObject({ decision: "alert", reason: "sem_previsao" });
    expect(decide(60, null, 10)).toMatchObject({ decision: "skip", reason: "sem_previsao" });
  });
  it("eclipse (sem elementos) não é bloqueado por idade", () => {
    expect(decide(91, clear, null).decision).toBe("alert");
  });
});

describe("tempo local (UTC-3)", () => {
  const t = (iso: string) => Date.parse(iso);
  it("madrugada pertence à noite anterior", () => {
    expect(nightKey(t("2026-11-17T05:51:00Z"))).toBe("2026-11-16"); // 02h51 de 17/11
    expect(nightKey(t("2026-11-16T22:42:00Z"))).toBe("2026-11-16"); // 19h42 de 16/11
  });
  it("horário de silêncio: 23h às 6h", () => {
    expect(isQuietHour(t("2026-11-17T05:51:00Z"))).toBe(true);
    expect(isQuietHour(t("2026-11-16T22:42:00Z"))).toBe(false);
    expect(isQuietHour(t("2026-11-17T09:10:00Z"))).toBe(false); // 6h10
  });
  it("início do dia local e formatação", () => {
    expect(new Date(localDayStart(t("2026-11-17T01:00:00Z"))).toISOString()).toBe("2026-11-16T03:00:00.000Z");
    expect(formatLocalTime(t("2026-11-16T22:42:00Z"))).toBe("19h42");
    expect(formatLocalTime(t("2026-11-17T07:05:00Z"))).toBe("4h05");
  });
});

describe("validação de entrada", () => {
  it("só aceita endpoints de serviços de push conhecidos, em https", () => {
    expect(isAllowedPushEndpoint("https://fcm.googleapis.com/fcm/send/abc")).toBe(true);
    expect(isAllowedPushEndpoint("https://web.push.apple.com/QGk")).toBe(true);
    expect(isAllowedPushEndpoint("https://updates.push.services.mozilla.com/wpush/v2/x")).toBe(true);
    expect(isAllowedPushEndpoint("http://fcm.googleapis.com/x")).toBe(false);
    expect(isAllowedPushEndpoint("https://evil.example/fcm.googleapis.com")).toBe(false);
    expect(isAllowedPushEndpoint("https://fcm.googleapis.com.evil.example/x")).toBe(false);
    expect(isAllowedPushEndpoint("https://169.254.169.254/")).toBe(false);
    expect(isAllowedPushEndpoint(42)).toBe(false);
  });
  it("preferências caem nos limites e nos padrões", () => {
    expect(normalizePrefs(undefined)).toEqual({ minIndex: 50, leadMinutes: 15, allowNight: 0, weeklyCap: 3 });
    expect(normalizePrefs({ minIndex: 5, leadMinutes: 999, allowNight: true, weeklyCap: "x" })).toEqual({ minIndex: 30, leadMinutes: 60, allowNight: 1, weeklyCap: 3 });
  });
  it("a grade contém a capital e recusa célula de fora", () => {
    expect(isGridCell(cellIdFor(-23.5505, -46.6333))).toBe(true);
    expect(isGridCell(cellIdFor(-22.9, -43.2))).toBe(false); // Rio
    expect(GRID_CELLS.length).toBeLessThan(60);
  });
});

describe("previsão de nuvens", () => {
  it("lê a resposta do Open-Meteo em frações", () => {
    const m = parseOpenMeteo({ hourly: { time: [1_800_000_000, 1_800_003_600], cloud_cover_low: [10, 100], cloud_cover_mid: [0, 50], cloud_cover_high: [80, null] } });
    expect(m.get(500_000)).toEqual({ low: 0.1, mid: 0, high: 0.8 });
    expect(m.size).toBe(1); // a hora com valor nulo é descartada
  });
  it("formato inesperado gera erro (vira 'sem previsão')", () => {
    expect(() => parseOpenMeteo({ nope: true })).toThrow();
  });
});

describe("texto do alerta", () => {
  const pass = { kind: "pass" as const, objectName: "ISS", start: { az: 315, el: 10 }, peak: { az: 0, el: 78 }, end: { az: 120, el: 30 }, durationSeconds: 240, magnitude: -3.4, startsInShadow: false, endsInShadow: true };
  it("passagem: hora, direção, altura, duração e chance", () => {
    const t = buildPushText(pass, Date.parse("2026-11-16T22:42:00Z"), 0, 85, true);
    expect(t.title).toBe("ISS às 19h42");
    expect(t.body).toBe("Aparece a noroeste e sobe até ficar quase no topo do céu. Visível por 4 min. Chance ótima de céu aberto.");
  });
  it("nunca promete: sem previsão, diz que não há previsão", () => {
    expect(buildPushText(pass, 0, 0, 80, false).body).toContain("Sem previsão de nuvens");
  });
  it("eclipse sempre traz o aviso de proteção ocular", () => {
    const t = buildPushText({ kind: "solar_eclipse", eclipseKind: "parcial", obscuration: 0.78, sunAltitudeAtPeak: 74 }, 0, Date.parse("2027-02-06T16:21:00Z"), 90, true);
    expect(t.title).toContain("13h21");
    expect(t.body).toContain("78%");
    expect(t.body).toContain("NUNCA olhe para o Sol");
  });
});
