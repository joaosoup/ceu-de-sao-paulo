import { Injectable, computed, inject } from '@angular/core';
import { localSolarEclipses, lunarEclipses, moonIlluminatedFraction, moonRiseSet, nextMoonQuarters } from '@ceu/sky-engine/astro';
import { Events } from './events';
import { Store } from './store';

const DAY = 86_400_000;

/** Lua e eclipses são calculados no próprio aparelho: não dependem de rede nem do servidor. */
@Injectable({ providedIn: 'root' })
export class Sky {
  private readonly store = inject(Store);
  private readonly events = inject(Events);
  // recalcula a cada hora, não a cada tique do relógio
  private readonly hour = computed(() => Math.floor(this.events.now() / 3_600_000) * 3_600_000);

  readonly moon = computed(() => {
    const obs = this.store.observer();
    const now = new Date(this.hour());
    const fraction = moonIlluminatedFraction(now);
    const quarters = nextMoonQuarters(now, 4);
    const waxing = quarters[0]?.quarter === 'crescente' || quarters[0]?.quarter === 'cheia';
    const rs = obs ? moonRiseSet(obs, now) : { rise: null, set: null };
    return { fraction, waxing, quarters, rise: rs.rise, set: rs.set, name: phaseName(fraction, waxing) };
  });

  readonly solarEclipses = computed(() => {
    const obs = this.store.observer();
    return obs ? localSolarEclipses(obs, new Date(this.hour() - DAY), new Date(this.hour() + 800 * DAY)) : [];
  });
  readonly nextSolarEclipse = computed(() => this.solarEclipses()[0] ?? null);

  readonly lunarEclipses = computed(() => {
    const obs = this.store.observer();
    return obs ? lunarEclipses(obs, new Date(this.hour()), new Date(this.hour() + 800 * DAY)).filter((e) => e.visibleAtPeak && e.kind !== 'penumbral') : [];
  });
}

function phaseName(f: number, waxing: boolean): string {
  if (f < 0.03) return 'Lua nova';
  if (f > 0.97) return 'Lua cheia';
  if (f > 0.45 && f < 0.55) return waxing ? 'Quarto crescente' : 'Quarto minguante';
  if (f <= 0.45) return waxing ? 'Lua crescente' : 'Lua minguante';
  return waxing ? 'Crescente gibosa' : 'Minguante gibosa';
}
