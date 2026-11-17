import { Injectable, computed, signal } from '@angular/core';
import { cellCenter, cellIdFor } from '@ceu/sky-engine/astro';
import { DEFAULT_PREFS, type Prefs } from './models';

interface Saved {
  cellId: string | null;
  placeName: string | null;
  subscription: { id: string; secret: string } | null;
  prefs: Prefs;
  feedback: Record<string, boolean>;
}
const KEY = 'ceu-sp:v1';
const EMPTY: Saved = { cellId: null, placeName: null, subscription: null, prefs: DEFAULT_PREFS, feedback: {} };

function load(): Saved {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...EMPTY, ...(JSON.parse(raw) as Partial<Saved>) } : EMPTY;
  } catch {
    return EMPTY; // navegação privada ou armazenamento bloqueado: o app funciona, só não lembra
  }
}

/**
 * Estado do aparelho. Privacidade: a coordenada exata NUNCA é guardada nem enviada;
 * é arredondada para a célula (~28 km) aqui, e só o id da célula segue adiante.
 */
@Injectable({ providedIn: 'root' })
export class Store {
  private readonly state = signal<Saved>(load());

  readonly cellId = computed(() => this.state().cellId);
  readonly placeName = computed(() => this.state().placeName);
  readonly subscription = computed(() => this.state().subscription);
  readonly prefs = computed(() => this.state().prefs);
  readonly feedback = computed(() => this.state().feedback);
  readonly observer = computed(() => {
    const id = this.state().cellId;
    return id ? cellCenter(id) : null;
  });

  private patch(p: Partial<Saved>): void {
    const next = { ...this.state(), ...p };
    this.state.set(next);
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* ver load() */ }
  }

  setLocation(lat: number, lon: number, placeName: string): void {
    this.patch({ cellId: cellIdFor(lat, lon), placeName });
  }
  setSubscription(s: { id: string; secret: string } | null): void { this.patch({ subscription: s }); }
  setPrefs(prefs: Prefs): void { this.patch({ prefs }); }
  setFeedback(eventId: string, saw: boolean): void { this.patch({ feedback: { ...this.state().feedback, [eventId]: saw } }); }
  /** "Desativar e apagar meus dados": não sobra nada no aparelho. */
  clearAll(): void {
    this.state.set(EMPTY);
    try { localStorage.removeItem(KEY); } catch { /* ver load() */ }
  }
}
