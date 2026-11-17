export interface SkyPt { az: number; el: number; }

export interface PassDetails {
  kind: 'pass';
  objectName: string;
  start: SkyPt; peak: SkyPt; end: SkyPt;
  durationSeconds: number;
  magnitude: number;
  startsInShadow: boolean;
  endsInShadow: boolean;
}
export interface EclipseDetails {
  kind: 'solar_eclipse';
  eclipseKind: string;
  obscuration: number;
  sunAltitudeAtPeak: number;
}
export interface EventDecision {
  index: number;
  alert: boolean;
  reason: string | null;
  clouds: { low: number; mid: number; high: number } | null;
}
export interface SkyEvent {
  id: string;
  kind: 'pass' | 'solar_eclipse';
  startsAt: number; peakAt: number; endsAt: number;
  details: PassDetails | EclipseDetails;
  geometryScore: number;
  quiet: boolean;
  decision: EventDecision | null;
  /** true só nos dados de exemplo (modo ?demo=1) */
  demo?: boolean;
}
export interface EventsResponse {
  cellId: string;
  generatedAt: number;
  elementsEpoch: number | null;
  events: SkyEvent[];
}
export interface Prefs { minIndex: number; leadMinutes: number; allowNight: boolean; weeklyCap: number; }
export const DEFAULT_PREFS: Prefs = { minIndex: 50, leadMinutes: 15, allowNight: false, weeklyCap: 3 };
