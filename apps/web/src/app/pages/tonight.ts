import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Events } from '../core/events';
import { countdown, hhmm, period, pct, relativeDay, shortDay, ymd } from '../core/format';
import type { PassDetails, SkyEvent } from '../core/models';
import { brightness, minutes, qualityOf, whereToLook } from '../core/quality';
import { Sky } from '../core/sky';
import { Store } from '../core/store';
import { AlertButton } from '../ui/alert-button';
import { MoonIcon } from '../ui/moon-icon';
import { QualityBadge } from '../ui/quality-badge';

@Component({
  selector: 'app-tonight',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, AlertButton, MoonIcon, QualityBadge],
  template: `
    <main class="page stack">
      <header class="row spread">
        <div>
          <p class="eyebrow">O Céu de São Paulo</p>
          <a routerLink="/inicio" class="place">{{ store.placeName() }} <span aria-hidden="true">›</span><span class="sr-only">trocar de local</span></a>
        </div>
      </header>

      @if (ev.demo) { <p class="demo small">Modo de demonstração: os eventos marcados como “exemplo” não são reais.</p> }

      @switch (ev.state()) {
        @case ('loading') { <section class="card hero skeleton" aria-busy="true"><p class="muted">Olhando o céu…</p></section> }
        @case ('error') {
          <section class="card stack">
            <h2>Não consegui buscar as passagens</h2>
            <p class="muted">Verifique a conexão. A Lua e os eclipses abaixo continuam valendo, porque são calculados no seu aparelho.</p>
            <button class="btn" (click)="reload()">Tentar de novo</button>
          </section>
        }
        @default {
          @if (ev.hero(); as h) {
            <a class="card hero fade" [routerLink]="['/evento', h.id]">
              <div class="row spread">
                <p class="eyebrow">{{ rel(h.startsAt) }} · {{ cd(h.startsAt) }}</p>
                <app-quality-badge [event]="h" />
              </div>
              <p class="time">{{ time(h.startsAt) }}</p>
              <h2>{{ title(h) }} @if (h.demo) { <span class="tag">exemplo</span> }</h2>
              @if (pass(h); as p) {
                <p class="where">{{ where(p) }}</p>
                <p class="muted">Visível por {{ mins(p) }} min, {{ bright(p) }}. {{ q(h).sky }}</p>
              }
              <span class="more">Ver para onde olhar <span aria-hidden="true">→</span></span>
            </a>
          } @else {
            <section class="card hero fade">
              <p class="eyebrow">Hoje à noite</p>
              <h2 class="none">Nada imperdível no céu hoje.</h2>
              @if (ev.nextGood(); as g) {
                <p class="muted">A próxima boa oportunidade é <strong>{{ rel(g.startsAt) }}, às {{ time(g.startsAt) }}</strong>.</p>
                <a class="btn" [routerLink]="['/evento', g.id]">Ver essa passagem</a>
              } @else {
                <p class="muted">Não há passagem boa da ISS nos próximos 10 dias. Isso é normal: ela alterna semanas visíveis com semanas sem passar no escuro. A Lua está logo abaixo.</p>
              }
            </section>
          }
        }
      }

      <app-alert-button />

      <a class="card moon row" routerLink="/calendario">
        <app-moon-icon class="moon-pic" [fraction]="sky.moon().fraction" [waxing]="sky.moon().waxing" />
        <div>
          <p class="eyebrow">Lua hoje</p>
          <h3>{{ sky.moon().name }}, {{ pc(sky.moon().fraction) }} iluminada</h3>
          <p class="muted small">
            @if (sky.moon().rise; as r) { Nasce às {{ time(r.getTime()) }}. }
            @if (sky.moon().set; as s) { Se põe às {{ time(s.getTime()) }}. }
          </p>
        </div>
      </a>

      @if (sky.nextSolarEclipse(); as e) {
        <a class="card eclipse" routerLink="/eclipse">
          <p class="eyebrow">Eclipse solar · {{ cd(e.peak.getTime()) }}</p>
          <h3>{{ pc(e.obscuration) }} do Sol encoberto em {{ day(e.peak.getTime()) }}</h3>
          <p class="muted small">Máximo às {{ time(e.peak.getTime()) }}. Ver horários e como observar com segurança <span aria-hidden="true">→</span></p>
        </a>
      }

      @if (groups().length) {
        <section class="stack">
          <h2 class="section">Próximos dias</h2>
          @for (g of groups(); track g.key) {
            <div>
              <p class="eyebrow day">{{ g.label }}</p>
              <ul class="list">
                @for (e of g.items; track e.id) {
                  <li>
                    <a class="item row spread" [routerLink]="['/evento', e.id]">
                      <span>
                        <strong>{{ time(e.startsAt) }}</strong> · {{ title(e) }} @if (e.demo) { <span class="tag">exemplo</span> }
                        <span class="muted small block">{{ sub(e) }}</span>
                      </span>
                      <app-quality-badge [event]="e" />
                    </a>
                  </li>
                }
              </ul>
            </div>
          }
        </section>
      }
    </main>
  `,
  styles: `
    .place { font-size: 20px; font-weight: 700; text-decoration: none; }
    .demo { color: var(--amber); border: 1px dashed var(--amber); border-radius: 12px; padding: 8px 12px; }
    .hero { display: block; text-decoration: none; padding: 22px; background: linear-gradient(160deg, #1d2757 0%, #141a3a 70%); }
    .hero > * + * { margin-top: 10px; }
    .hero.skeleton { min-height: 220px; display: grid; place-items: center; }
    .time { font-size: 72px; line-height: 1; font-weight: 800; letter-spacing: -0.04em; color: var(--amber); font-variant-numeric: tabular-nums; }
    .hero h2 { font-size: 22px; }
    .hero h2.none { font-size: 28px; line-height: 1.15; }
    .where { font-size: 18px; }
    .more { display: inline-block; font-weight: 700; color: var(--amber); }
    .tag { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: var(--amber); border: 1px solid var(--amber); border-radius: 6px; padding: 1px 5px; vertical-align: middle; }
    .moon, .eclipse { text-decoration: none; display: flex; }
    .eclipse { display: block; border-color: #7a5a22; background: linear-gradient(160deg, #2b2110 0%, #161d3d 75%); }
    .eclipse > * + * { margin-top: 6px; }
    .moon-pic { width: 64px; flex: none; }
    .section { font-size: 20px; margin-top: 8px; }
    .day { margin-bottom: 6px; }
    .list { list-style: none; margin: 0; padding: 0; border: 1px solid var(--line); border-radius: var(--radius); overflow: hidden; }
    .list li + li { border-top: 1px solid var(--line); }
    .item { padding: 14px 16px; min-height: 64px; text-decoration: none; background: var(--card); }
    .block { display: block; }
  `,
})
export class Tonight {
  readonly store = inject(Store);
  readonly ev = inject(Events);
  readonly sky = inject(Sky);

  readonly groups = computed(() => {
    const now = this.ev.now();
    const heroId = this.ev.hero()?.id;
    const map = new Map<string, { key: string; label: string; items: SkyEvent[] }>();
    for (const e of this.ev.upcoming()) {
      if (e.id === heroId || e.kind !== 'pass' || e.startsAt > now + 8 * 86_400_000) continue;
      const key = ymd(e.startsAt);
      if (!map.has(key)) map.set(key, { key, label: key === ymd(now) ? 'Hoje' : key === ymd(now + 86_400_000) ? 'Amanhã' : shortDay(e.startsAt), items: [] });
      map.get(key)!.items.push(e);
    }
    return [...map.values()];
  });

  reload(): void { const c = this.store.cellId(); if (c) void this.ev.load(c); }
  time = hhmm;
  pc = pct;
  rel = (ms: number) => relativeDay(ms, this.ev.now());
  cd = (ms: number) => countdown(ms, this.ev.now());
  day = (ms: number) => new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: 'numeric', month: 'long', year: 'numeric' }).format(ms);
  q = qualityOf;
  where = whereToLook;
  mins = minutes;
  bright = brightness;
  pass = (e: SkyEvent): PassDetails | null => (e.details.kind === 'pass' ? e.details : null);
  title = (e: SkyEvent) => (e.details.kind === 'pass' ? `${e.details.objectName === 'ISS' ? 'Estação Espacial (ISS)' : e.details.objectName}` : 'Eclipse solar');
  sub = (e: SkyEvent) => {
    const p = this.pass(e);
    return p ? `${period(e.startsAt)}, ${minutes(p)} min, ${brightness(p)}` : '';
  };
}
