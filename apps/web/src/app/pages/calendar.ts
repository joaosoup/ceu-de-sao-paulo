import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Events } from '../core/events';
import { countdown, hhmm, longDay, pct } from '../core/format';
import { Sky } from '../core/sky';
import { MoonIcon } from '../ui/moon-icon';

const QUARTER: Record<string, { name: string; f: number; waxing: boolean }> = {
  nova: { name: 'Lua nova', f: 0, waxing: true },
  crescente: { name: 'Quarto crescente', f: 0.5, waxing: true },
  cheia: { name: 'Lua cheia', f: 1, waxing: true },
  minguante: { name: 'Quarto minguante', f: 0.5, waxing: false },
};

@Component({
  selector: 'app-calendar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, MoonIcon],
  template: `
    <main class="page stack fade">
      <p class="eyebrow">Lua e calendário</p>
      <section class="card today">
        <app-moon-icon class="big" [fraction]="sky.moon().fraction" [waxing]="sky.moon().waxing" />
        <h1>{{ sky.moon().name }}</h1>
        <p class="muted">{{ pc(sky.moon().fraction) }} iluminada.
          @if (sky.moon().rise; as r) { Nasce às {{ time(r.getTime()) }}. }
          @if (sky.moon().set; as s) { Se põe às {{ time(s.getTime()) }}. }
        </p>
        <p class="muted small">A Lua é o que sempre dá para ver na cidade, mesmo com as luzes.</p>
      </section>

      <section class="stack">
        <h2>Próximas fases</h2>
        <ul class="list">
          @for (qtr of sky.moon().quarters; track qtr.time.getTime()) {
            <li class="row">
              <app-moon-icon class="mini" [fraction]="info(qtr.quarter).f" [waxing]="info(qtr.quarter).waxing" />
              <span><strong>{{ info(qtr.quarter).name }}</strong><span class="muted small block">{{ day(qtr.time.getTime()) }}, {{ time(qtr.time.getTime()) }}</span></span>
            </li>
          }
        </ul>
      </section>

      <section class="stack">
        <h2>Eclipses visíveis daqui</h2>
        <ul class="list">
          @for (e of sky.solarEclipses(); track e.peak.getTime()) {
            <li>
              <a routerLink="/eclipse" class="link">
                <strong>Eclipse solar {{ e.kind }}, {{ pc(e.obscuration) }} do Sol</strong>
                <span class="muted small block">{{ day(e.peak.getTime()) }}, máximo às {{ time(e.peak.getTime()) }} · {{ cd(e.peak.getTime()) }}</span>
              </a>
            </li>
          }
          @for (e of sky.lunarEclipses(); track e.peak.getTime()) {
            <li>
              <strong>Eclipse lunar {{ e.kind }}@if (e.kind === 'parcial') {, {{ pc(e.obscuration) }} da Lua }</strong>
              <span class="muted small block">{{ day(e.peak.getTime()) }}, máximo às {{ time(e.peak.getTime()) }}</span>
            </li>
          }
          @empty { <li class="muted">Nenhum eclipse visível nos próximos dois anos.</li> }
        </ul>
        <p class="muted small">Planetas e chuvas de meteoros chegam numa próxima versão.</p>
      </section>
    </main>
  `,
  styles: `
    .today { text-align: center; } .today > * + * { margin-top: 8px; }
    .big { width: 140px; margin: 0 auto; } .mini { width: 36px; flex: none; }
    h1 { font-size: 30px; } h2 { font-size: 20px; }
    .list { list-style: none; margin: 0; padding: 0; border: 1px solid var(--line); border-radius: var(--radius); overflow: hidden; background: var(--card); }
    .list li { padding: 14px 16px; } .list li + li { border-top: 1px solid var(--line); }
    .block { display: block; } .link { text-decoration: none; display: block; }
  `,
})
export class Calendar {
  readonly sky = inject(Sky);
  private readonly ev = inject(Events);
  time = hhmm; day = longDay; pc = pct;
  cd = (ms: number) => countdown(ms, this.ev.now());
  info = (q: string) => QUARTER[q] ?? QUARTER['nova']!;
}
