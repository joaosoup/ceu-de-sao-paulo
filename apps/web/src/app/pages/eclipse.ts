import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Events } from '../core/events';
import { countdown, hhmm, longDay, pct } from '../core/format';
import { Sky } from '../core/sky';
import { AlertButton } from '../ui/alert-button';

@Component({
  selector: 'app-eclipse',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, AlertButton],
  template: `
    <main class="page stack fade">
      <a routerLink="/" class="back"><span aria-hidden="true">←</span> Hoje à noite</a>
      @if (sky.nextSolarEclipse(); as e) {
        <header class="stack">
          <p class="eyebrow">Eclipse solar {{ e.kind }} · {{ cd(e.peak.getTime()) }}</p>
          <h1>{{ day(e.peak.getTime()) }}</h1>
        </header>

        <section class="card sun">
          <svg viewBox="0 0 200 200" role="img" [attr.aria-label]="'Ilustração: a Lua cobrindo ' + pc(e.obscuration) + ' do Sol'">
            <defs><clipPath id="sunclip"><circle cx="100" cy="100" r="70" /></clipPath></defs>
            <circle cx="100" cy="100" r="70" fill="#ffc857" />
            <circle [attr.cx]="moonX()" cy="92" r="68" fill="#0c1230" clip-path="url(#sunclip)" />
          </svg>
          <p class="big">{{ pc(e.obscuration) }}</p>
          <p class="muted">do Sol encoberto pela Lua no ponto máximo, visto da sua região.</p>
        </section>

        <section class="card warn stack" role="note">
          <h2><span aria-hidden="true">⚠</span> Nunca olhe direto para o Sol</h2>
          <p>Mesmo com {{ pc(e.obscuration) }} encoberto, o Sol queima a retina em segundos e <strong>sem dor</strong>. Óculos escuros, chapa de raio X, vidro esfumaçado e filme fotográfico <strong>não protegem</strong>.</p>
          <ul>
            <li>Use <strong>óculos próprios para eclipse</strong> (norma ISO 12312-2) ou vidro de soldador número 14.</li>
            <li>Ou veja sem olhar para o Sol: fure um papelão com um prego e projete a imagem no chão. A sombra das folhas de uma árvore faz o mesmo.</li>
            <li>Não aponte binóculo, câmera ou celular para o Sol sem filtro solar na frente da lente.</li>
          </ul>
        </section>

        <section class="card stack">
          <h2>Horários na sua região</h2>
          <ol class="steps">
            <li><strong>{{ time(e.partialBegin.getTime()) }}</strong> A Lua começa a “morder” o Sol.</li>
            <li><strong>{{ time(e.peak.getTime()) }}</strong> Máximo: {{ pc(e.obscuration) }} encoberto. O Sol estará {{ high(e.sunAltitudeAtPeak) }}.</li>
            <li><strong>{{ time(e.partialEnd.getTime()) }}</strong> Fim do eclipse.</li>
          </ol>
          <p class="muted small">Aqui o eclipse é parcial: o dia não escurece de verdade, mas a luz fica estranha, mais fria, e as sombras ficam mais nítidas. Quanto ao tempo, a previsão de nuvens só é confiável na véspera.</p>
        </section>

        <app-alert-button />
      } @else {
        <section class="card"><p class="muted">Nenhum eclipse solar visível daqui nos próximos dois anos.</p></section>
      }
    </main>
  `,
  styles: `
    .back { text-decoration: none; color: var(--ink-2); font-weight: 600; display: inline-block; min-height: 44px; line-height: 44px; }
    h1 { font-size: 30px; line-height: 1.15; letter-spacing: -0.01em; } h1::first-letter { text-transform: uppercase; }
    h2 { font-size: 19px; }
    .sun { text-align: center; } .sun svg { width: 180px; height: auto; }
    .big { font-size: 64px; font-weight: 800; line-height: 1; color: var(--amber); letter-spacing: -0.03em; }
    ul { margin: 0; padding-left: 20px; } li + li { margin-top: 8px; }
    .steps { margin: 0; padding: 0; list-style: none; border-top: 1px solid var(--line); }
    .steps li { padding: 12px 0; border-bottom: 1px solid var(--line); }
    .steps strong { display: inline-block; min-width: 64px; color: var(--amber); font-variant-numeric: tabular-nums; }
  `,
})
export class Eclipse {
  readonly sky = inject(Sky);
  private readonly ev = inject(Events);
  time = hhmm; day = longDay; pc = pct;
  cd = (ms: number) => countdown(ms, this.ev.now());
  high = (alt: number) => (alt > 60 ? 'quase a pino' : alt > 30 ? 'a meia altura' : 'baixo no céu');
  /** Posição do disco da Lua para a ilustração (aproximação visual, não a geometria exata). */
  readonly moonX = computed(() => 100 + 140 * (1 - (this.sky.nextSolarEclipse()?.obscuration ?? 0)) * 0.9 - 14);
}
