import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { Api } from './api';
import type { SkyEvent } from './models';
import { isGood } from './quality';
import { Store } from './store';

/** Dados de EXEMPLO, só com ?demo=1 na URL: servem para ver as telas num dia sem passagem boa. */
function demoEvents(now: number): SkyEvent[] {
  const at = (h: number, m: number, dayOffset = 0) => {
    const d = new Date(now + dayOffset * 86_400_000);
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), h + 3, m);
  };
  let s = at(19, 42);
  if (s < now + 30 * 60_000) s += 86_400_000;
  return [
    { id: 'demo-1', demo: true, kind: 'pass', startsAt: s, peakAt: s + 150_000, endsAt: s + 240_000, geometryScore: 96, quiet: false,
      details: { kind: 'pass', objectName: 'ISS', start: { az: 312, el: 10 }, peak: { az: 20, el: 78 }, end: { az: 118, el: 34 }, durationSeconds: 240, magnitude: -3.6, startsInShadow: false, endsInShadow: true },
      decision: { index: 88, alert: true, reason: null, clouds: { low: 0.05, mid: 0, high: 0.2 } } },
    { id: 'demo-2', demo: true, kind: 'pass', startsAt: s + 2 * 86_400_000 - 47 * 60_000, peakAt: s + 2 * 86_400_000 - 45 * 60_000, endsAt: s + 2 * 86_400_000 - 43 * 60_000, geometryScore: 61, quiet: false,
      details: { kind: 'pass', objectName: 'ISS', start: { az: 205, el: 10 }, peak: { az: 150, el: 33 }, end: { az: 80, el: 10 }, durationSeconds: 250, magnitude: -2.1, startsInShadow: false, endsInShadow: false },
      decision: null },
  ];
}

@Injectable({ providedIn: 'root' })
export class Events {
  private readonly api = inject(Api);
  private readonly store = inject(Store);

  readonly demo = new URLSearchParams(location.search).has('demo') || sessionStorage.getItem('ceu-demo') === '1';
  readonly events = signal<SkyEvent[]>([]);
  readonly state = signal<'idle' | 'loading' | 'ready' | 'error'>('idle');
  readonly elementsEpoch = signal<number | null>(null);
  readonly now = signal(Date.now());

  /** Próximos eventos ainda não terminados. */
  readonly upcoming = computed(() => this.events().filter((e) => e.endsAt > this.now()));
  /** O melhor evento das próximas 24 h, se houver algum que valha a pena. */
  readonly hero = computed(() => {
    const soon = this.upcoming().filter((e) => e.startsAt < this.now() + 24 * 3_600_000 && isGood(e));
    return soon.sort((a, b) => (b.decision?.index ?? b.geometryScore) - (a.decision?.index ?? a.geometryScore))[0] ?? null;
  });
  readonly nextGood = computed(() => this.upcoming().find((e) => isGood(e)) ?? null);

  constructor() {
    if (this.demo) sessionStorage.setItem('ceu-demo', '1');
    setInterval(() => this.now.set(Date.now()), 30_000);
    effect(() => {
      const cell = this.store.cellId();
      if (cell) void this.load(cell);
    });
  }

  byId(id: string): SkyEvent | null {
    return this.events().find((e) => e.id === id) ?? null;
  }

  async load(cellId: string): Promise<void> {
    this.state.set('loading');
    try {
      const res = await this.api.events(cellId);
      this.events.set(this.demo ? [...demoEvents(Date.now()), ...res.events].sort((a, b) => a.startsAt - b.startsAt) : res.events);
      this.elementsEpoch.set(res.elementsEpoch);
      this.state.set('ready');
    } catch {
      if (this.demo) { this.events.set(demoEvents(Date.now())); this.state.set('ready'); }
      else this.state.set('error');
    }
  }
}
