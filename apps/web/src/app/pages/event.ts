import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Api } from '../core/api';
import { Events } from '../core/events';
import { countdown, hhmm, longDay, pct, relativeDay } from '../core/format';
import type { PassDetails } from '../core/models';
import { brightness, compassDirection, describeElevation, minutes, qualityOf, whereToLook } from '../core/quality';
import { Store } from '../core/store';
import { AlertButton } from '../ui/alert-button';
import { CompassRose } from '../ui/compass-rose';
import { QualityBadge } from '../ui/quality-badge';

@Component({
  selector: 'app-event',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, AlertButton, CompassRose, QualityBadge],
  template: `
    <main class="page stack fade">
      <a routerLink="/" class="back"><span aria-hidden="true">←</span> Hoje à noite</a>
      @if (event(); as e) {
        <header class="stack">
          <div class="row spread">
            <p class="eyebrow">{{ rel(e.startsAt) }}@if (e.endsAt > ev.now()) { · {{ cd(e.startsAt) }} }</p>
            <app-quality-badge [event]="e" />
          </div>
          <h1>{{ time(e.startsAt) }}</h1>
          <p class="lead">{{ pass() ? 'Estação Espacial Internacional' : 'Eclipse solar' }} @if (e.demo) { <span class="tag">exemplo</span> }</p>
          <p class="muted">{{ day(e.startsAt) }}</p>
        </header>

        @if (pass(); as p) {
          <section class="card stack">
            <h2>Para onde olhar</h2>
            <p class="where">{{ where(p) }}</p>
            <app-compass-rose [pass]="p" />
            <p class="muted small center">Segure o celular deitado, com o N apontando para o norte. A borda do círculo é o horizonte; o centro é o topo do céu.</p>
            <ol class="steps">
              <li><strong>{{ time(e.startsAt) }}</strong> {{ p.startsInShadow ? 'Surge' : 'Aparece' }} a {{ dir(p.start.az) }}, {{ elev(p.start.el) }}.</li>
              <li><strong>{{ time(e.peakAt) }}</strong> Ponto mais alto, a {{ dir(p.peak.az) }}, {{ elev(p.peak.el) }}.</li>
              <li><strong>{{ time(e.endsAt) }}</strong> {{ p.endsInShadow ? 'Some na sombra da Terra' : 'Desce' }} a {{ dir(p.end.az) }}.</li>
            </ol>
          </section>

          <section class="card stack">
            <h2>O que esperar</h2>
            <ul class="facts">
              <li><span class="muted">Brilho</span><strong>{{ bright(p) }}</strong></li>
              <li><span class="muted">Duração</span><strong>{{ mins(p) }} min</strong></li>
              <li><span class="muted">Céu</span><strong>{{ q().sky }}</strong></li>
            </ul>
            <p class="muted small">É um ponto de luz branca e firme, sem piscar, cruzando o céu mais rápido que um avião. Não precisa de binóculo. Se pisca ou tem luz colorida, é avião.</p>
            <details>
              <summary>Detalhes técnicos</summary>
              <p class="small muted">Magnitude estimada {{ p.magnitude }} (erro típico de 1). Elevação máxima {{ p.peak.el }}°, azimute {{ p.start.az }}° → {{ p.end.az }}°. Índice de observação {{ q().index }} de 100.
                @if (e.decision?.clouds; as c) { Nuvens previstas: baixas {{ pc(c.low) }}, médias {{ pc(c.mid) }}, altas {{ pc(c.high) }}. }
                Horários podem mudar alguns segundos quando chegam dados novos da órbita.</p>
            </details>
          </section>
        }

        @if (e.endsAt < ev.now() && store.subscription() && !e.demo) {
          <section class="card stack">
            <h2>Você viu?</h2>
            @if (answered() === null) {
              <div class="row"><button class="btn primary" (click)="answer(true)">Vi!</button><button class="btn" (click)="answer(false)">Não vi</button></div>
            } @else { <p class="muted">{{ answered() ? 'Que bom! Isso ajuda a calibrar os alertas.' : 'Obrigado. Vamos usar isso para avisar melhor da próxima vez.' }}</p> }
          </section>
        } @else if (e.endsAt > ev.now()) {
          <app-alert-button />
          <button class="btn block" (click)="share()">Compartilhar</button>
        }
      } @else {
        <section class="card stack">
          <h2>Esse evento não está mais disponível</h2>
          <p class="muted">Ele já passou ou o horário foi recalculado.</p>
          <a class="btn" routerLink="/">Ver o que há hoje</a>
        </section>
      }
    </main>
  `,
  styles: `
    .back { text-decoration: none; color: var(--ink-2); font-weight: 600; display: inline-block; min-height: 44px; line-height: 44px; }
    h1 { font-size: 80px; line-height: 1; font-weight: 800; letter-spacing: -0.04em; color: var(--amber); font-variant-numeric: tabular-nums; }
    .lead { font-size: 22px; font-weight: 700; }
    .where { font-size: 18px; }
    .center { text-align: center; }
    .steps { margin: 0; padding: 0; list-style: none; border-top: 1px solid var(--line); }
    .steps li { padding: 12px 0; border-bottom: 1px solid var(--line); }
    .steps strong { display: inline-block; min-width: 64px; color: var(--amber); font-variant-numeric: tabular-nums; }
    .facts { list-style: none; margin: 0; padding: 0; }
    .facts li { display: flex; justify-content: space-between; gap: 16px; padding: 10px 0; border-bottom: 1px solid var(--line); }
    .facts strong { text-align: right; }
    summary { cursor: pointer; min-height: 44px; line-height: 44px; font-weight: 600; }
    .tag { font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--amber); border: 1px solid var(--amber); border-radius: 6px; padding: 1px 5px; vertical-align: middle; }
  `,
})
export class EventPage {
  readonly id = input.required<string>();
  readonly ev = inject(Events);
  readonly store = inject(Store);
  private readonly api = inject(Api);
  private readonly justAnswered = signal<boolean | null>(null);

  readonly event = computed(() => this.ev.byId(this.id()));
  readonly pass = computed<PassDetails | null>(() => {
    const d = this.event()?.details;
    return d?.kind === 'pass' ? d : null;
  });
  readonly q = computed(() => qualityOf(this.event()!));
  readonly answered = computed(() => this.justAnswered() ?? this.store.feedback()[this.id()] ?? null);

  time = hhmm; day = longDay; pc = pct;
  rel = (ms: number) => relativeDay(ms, this.ev.now());
  cd = (ms: number) => countdown(ms, this.ev.now());
  where = whereToLook; bright = brightness; mins = minutes;
  dir = compassDirection; elev = describeElevation;

  async answer(saw: boolean): Promise<void> {
    this.justAnswered.set(saw);
    this.store.setFeedback(this.id(), saw);
    const s = this.store.subscription();
    if (s) await this.api.feedback(s.id, s.secret, this.id(), saw).catch(() => undefined);
  }

  async share(): Promise<void> {
    const e = this.event();
    const p = this.pass();
    if (!e) return;
    const text = p
      ? `A Estação Espacial passa sobre São Paulo ${this.rel(e.startsAt)} às ${hhmm(e.startsAt)}. ${whereToLook(p)}`
      : `Eclipse solar em São Paulo ${this.rel(e.startsAt)}, máximo às ${hhmm(e.peakAt)}.`;
    const data = { title: 'O Céu de São Paulo', text, url: location.href };
    if (navigator.share) await navigator.share(data).catch(() => undefined);
    else await navigator.clipboard?.writeText(`${text} ${location.href}`).catch(() => undefined);
  }
}
