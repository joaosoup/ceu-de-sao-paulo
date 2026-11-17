import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { PLACES, inBounds } from '../core/places';
import { Push } from '../core/push';
import { Store } from '../core/store';

@Component({
  selector: 'app-welcome',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="page stack fade">
      <p class="eyebrow">O Céu de São Paulo</p>
      <h1>Onde você está?</h1>
      <p class="muted">Para dizer a que horas e para que lado olhar. Guardamos só a região aproximada (um quadrado de uns 28 km), nunca o seu endereço.</p>

      <button class="btn primary block" (click)="useGps()" [disabled]="locating()">
        {{ locating() ? 'Localizando…' : 'Usar minha localização' }}
      </button>
      @if (message(); as m) { <p class="small" role="alert" style="color: var(--amber)">{{ m }}</p> }

      <div class="card stack">
        <label for="place"><strong>Ou escolha a cidade</strong></label>
        <select id="place" #sel>
          @for (p of places; track p.name) { <option [value]="$index">{{ p.name }}</option> }
        </select>
        <button class="btn block" (click)="choose(+sel.value)">Continuar</button>
      </div>
      <p class="muted small">Por enquanto atendemos a Grande São Paulo.</p>
    </main>
  `,
  styles: `h1 { font-size: 34px; line-height: 1.1; letter-spacing: -0.02em; }`,
})
export class Welcome {
  private readonly store = inject(Store);
  private readonly push = inject(Push);
  private readonly router = inject(Router);
  readonly places = PLACES;
  readonly locating = signal(false);
  readonly message = signal<string | null>(null);

  useGps(): void {
    if (!('geolocation' in navigator)) { this.message.set('Este aparelho não informa a localização. Escolha a cidade abaixo.'); return; }
    this.locating.set(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        this.locating.set(false);
        const { latitude, longitude } = pos.coords;
        if (!inBounds(latitude, longitude)) { this.message.set('Você parece estar fora da Grande São Paulo. Por enquanto só atendemos essa região; escolha uma cidade abaixo para ver como funciona.'); return; }
        this.done(latitude, longitude, 'Sua região');
      },
      () => { this.locating.set(false); this.message.set('Não foi possível obter a localização. Sem problema: escolha a cidade abaixo.'); },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 600_000 },
    );
  }
  choose(i: number): void {
    const p = this.places[i];
    if (p) this.done(p.lat, p.lon, p.name);
  }
  private done(lat: number, lon: number, name: string): void {
    this.store.setLocation(lat, lon, name);
    void this.push.sync();
    void this.router.navigateByUrl('/');
  }
}
