import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import type { Prefs } from '../core/models';
import { Push } from '../core/push';
import { Store } from '../core/store';
import { AlertButton } from '../ui/alert-button';

@Component({
  selector: 'app-settings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, AlertButton],
  template: `
    <main class="page stack fade">
      <p class="eyebrow">Ajustes</p>

      <section class="card stack">
        <h2>Local</h2>
        <p>{{ store.placeName() }}</p>
        <a class="btn" routerLink="/inicio">Trocar de local</a>
      </section>

      <section class="card stack">
        <h2>Alertas</h2>
        <app-alert-button />

        <label for="min"><strong>Avisar quando a chance for</strong></label>
        <select id="min" [value]="store.prefs().minIndex" (change)="set({ minIndex: +$any($event.target).value })">
          <option value="70">Só excelente</option>
          <option value="50">Boa ou excelente (recomendado)</option>
          <option value="30">Qualquer passagem visível</option>
        </select>

        <label for="lead"><strong>Antecedência do aviso</strong></label>
        <select id="lead" [value]="store.prefs().leadMinutes" (change)="set({ leadMinutes: +$any($event.target).value })">
          <option value="5">5 minutos antes</option>
          <option value="15">15 minutos antes</option>
          <option value="30">30 minutos antes</option>
          <option value="60">1 hora antes</option>
        </select>

        <label class="check"><input type="checkbox" [checked]="store.prefs().allowNight" (change)="set({ allowNight: $any($event.target).checked })" />
          <span><strong>Avisar também de madrugada</strong><span class="muted small block">Sem isso, nada chega entre 23h e 6h.</span></span></label>

        <label class="check"><input type="checkbox" [checked]="store.prefs().weeklyCap > 3" (change)="set({ weeklyCap: $any($event.target).checked ? 99 : 3 })" />
          <span><strong>Sem limite por semana</strong><span class="muted small block">O padrão é no máximo 3 avisos por semana, um por noite.</span></span></label>
      </section>

      <section class="card stack">
        <h2>Privacidade</h2>
        <p class="muted small">Não há cadastro. Para enviar alertas guardamos três coisas: o endereço de notificação do seu navegador, a sua região aproximada (um quadrado de cerca de 28 km) e as preferências acima. Sua localização exata nunca sai do aparelho. O endereço de IP de cada acesso é usado só para barrar abuso e não é guardado.</p>
        <p class="muted small">Os alertas passam pelos serviços de notificação do Google, da Apple ou da Mozilla, conforme o seu navegador, e o site é hospedado na Cloudflare, fora do Brasil. Inscrições sem uso por 90 dias são apagadas.</p>
        <p class="muted small">Dúvidas ou pedidos sobre seus dados: <a href="https://github.com/joaosoup/ceu-de-sao-paulo/issues">abra um chamado no repositório do projeto</a>.</p>
        <button class="btn block danger" (click)="erase()" [disabled]="erasing()">{{ erasing() ? 'Apagando…' : 'Desativar e apagar meus dados' }}</button>
      </section>

      <p class="muted small center">Previsão de nuvens: <a href="https://open-meteo.com/">Open-Meteo</a> (CC BY 4.0). Órbitas: CelesTrak. Projeto aberto, sem anúncios.</p>
    </main>
  `,
  styles: `
    h2 { font-size: 19px; }
    .check { display: flex; gap: 12px; align-items: flex-start; min-height: 48px; cursor: pointer; }
    .check input { width: 24px; height: 24px; flex: none; margin-top: 2px; accent-color: var(--amber); }
    .block { display: block; } .center { text-align: center; }
    .danger { border-color: #7a3a32; color: var(--danger); }
  `,
})
export class Settings {
  readonly store = inject(Store);
  private readonly push = inject(Push);
  private readonly router = inject(Router);
  readonly erasing = signal(false);

  set(p: Partial<Prefs>): void {
    this.store.setPrefs({ ...this.store.prefs(), ...p });
    void this.push.sync();
  }
  async erase(): Promise<void> {
    this.erasing.set(true);
    await this.push.disable();
    this.store.clearAll();
    this.erasing.set(false);
    void this.router.navigateByUrl('/inicio');
  }
}
