/** Observador na superfície. Latitude e longitude em graus, altitude em metros. */
export interface ObserverLocation {
  latitude: number;
  longitude: number;
  altitudeMeters?: number;
}

/**
 * Elementos orbitais no formato OMM (o JSON/CSV do CelesTrak).
 * Só os campos que o SGP4 usa são obrigatórios.
 */
export interface OmmElements {
  OBJECT_NAME: string;
  OBJECT_ID: string;
  EPOCH: string;
  MEAN_MOTION: number;
  ECCENTRICITY: number;
  INCLINATION: number;
  RA_OF_ASC_NODE: number;
  ARG_OF_PERICENTER: number;
  MEAN_ANOMALY: number;
  EPHEMERIS_TYPE: number;
  CLASSIFICATION_TYPE: string;
  NORAD_CAT_ID: number;
  ELEMENT_SET_NO: number;
  REV_AT_EPOCH: number;
  BSTAR: number;
  MEAN_MOTION_DOT: number;
  MEAN_MOTION_DDOT: number;
}

/** Um ponto da passagem visto pelo observador. */
export interface SkyPoint {
  time: Date;
  /** Graus a partir do norte, sentido horário. */
  azimuth: number;
  /** Graus acima do horizonte. */
  elevation: number;
}

export interface VisiblePass {
  noradId: number;
  objectName: string;
  /** Início, ponto mais alto e fim do trecho VISÍVEL (não da passagem inteira). */
  start: SkyPoint;
  peak: SkyPoint;
  end: SkyPoint;
  durationSeconds: number;
  /** Magnitude estimada no ponto mais alto. Menor = mais brilhante. Erro típico: ~1. */
  magnitude: number;
  /** true quando o satélite entra na sombra da Terra antes de descer ("some" no céu). */
  endsInShadow: boolean;
  /** true quando sai da sombra já no alto ("aparece" no céu). */
  startsInShadow: boolean;
  /** Altura do Sol no ponto mais alto, em graus (negativa = abaixo do horizonte). */
  sunAltitudeAtPeak: number;
  /** Época dos elementos orbitais usados; serve para bloquear alertas com dados velhos. */
  elementsEpoch: Date;
}

export interface PassSearchOptions {
  from: Date;
  days: number;
  /** Elevação mínima para contar como visível. Padrão: 10°. */
  minElevation?: number;
  /** O Sol precisa estar abaixo disto no local. Padrão: -6° (fim do crepúsculo civil). */
  maxSunAltitude?: number;
  /** Magnitude padrão do objeto a 1000 km, 50% iluminado. Padrão: -1,8 (ISS). */
  standardMagnitude?: number;
}

export interface CloudCover {
  /** Frações de 0 a 1. */
  low: number;
  mid: number;
  high: number;
}

export type QualityClass = "excelente" | "boa" | "dificil" | "oculta";
