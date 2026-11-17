import type { ObserverLocation, OmmElements } from "../src/index.js";

export const SAO_PAULO: ObserverLocation = { latitude: -23.5505, longitude: -46.6333, altitudeMeters: 760 };

/**
 * ATENÇÃO: elementos SINTÉTICOS, parecidos com os da ISS. Servem para testar a
 * lógica (invariantes), não horários reais. Substituir por um arquivo real do
 * CelesTrak + passagens conferidas numa fonte externa (ver test/README.md).
 */
export const ISS_LIKE_SYNTHETIC: OmmElements = {
  OBJECT_NAME: "ISS-LIKE (SINTETICO)",
  OBJECT_ID: "1998-067A",
  EPOCH: "2026-11-16T12:00:00.000000",
  MEAN_MOTION: 15.5,
  ECCENTRICITY: 0.0005,
  INCLINATION: 51.64,
  RA_OF_ASC_NODE: 120.0,
  ARG_OF_PERICENTER: 90.0,
  MEAN_ANOMALY: 10.0,
  EPHEMERIS_TYPE: 0,
  CLASSIFICATION_TYPE: "U",
  NORAD_CAT_ID: 25544,
  ELEMENT_SET_NO: 999,
  REV_AT_EPOCH: 50000,
  BSTAR: 0.0002,
  MEAN_MOTION_DOT: 0.0001,
  MEAN_MOTION_DDOT: 0,
};
