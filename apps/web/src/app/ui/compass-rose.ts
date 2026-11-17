import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { compassDirection, describeElevation } from '@ceu/sky-engine/astro';
import type { PassDetails } from '../core/models';

/**
 * Mapa do céu simplificado: a borda é o horizonte, o centro é o topo do céu.
 * Orientado como um mapa (norte em cima, leste à direita): é só segurar o celular
 * deitado com o N apontando para o norte.
 */
@Component({
  selector: 'app-compass-rose',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg viewBox="0 0 300 300" role="img" [attr.aria-label]="label()">
      <circle cx="150" cy="150" r="120" class="horizon" />
      <circle cx="150" cy="150" r="80" class="ring" />
      <circle cx="150" cy="150" r="40" class="ring" />
      <line x1="150" y1="30" x2="150" y2="270" class="ring" />
      <line x1="30" y1="150" x2="270" y2="150" class="ring" />
      <text x="150" y="20" class="card n">N</text>
      <text x="150" y="292" class="card">S</text>
      <text x="284" y="155" class="card">L</text>
      <text x="16" y="155" class="card">O</text>
      <path [attr.d]="path()" class="track" />
      <circle [attr.cx]="pts().start.x" [attr.cy]="pts().start.y" r="7" class="start" />
      <circle [attr.cx]="pts().end.x" [attr.cy]="pts().end.y" r="5" class="end" />
      <circle [attr.cx]="pts().peak.x" [attr.cy]="pts().peak.y" r="4" class="peak" />
      <text [attr.x]="pts().start.x" [attr.y]="pts().start.y - 12" class="tag">começa aqui</text>
    </svg>
  `,
  styles: `
    :host { display: block; max-width: 300px; margin: 0 auto; }
    svg { width: 100%; height: auto; display: block; }
    .horizon { fill: #0c1230; stroke: #4a568f; stroke-width: 2; }
    .ring { fill: none; stroke: #2a3360; stroke-width: 1; }
    .card { fill: #b9c1e4; font: 600 15px system-ui, sans-serif; text-anchor: middle; }
    .card.n { fill: #ffc857; }
    .track { fill: none; stroke: #ffc857; stroke-width: 4; stroke-linecap: round; }
    .start { fill: #ffc857; }
    .end { fill: #0c1230; stroke: #ffc857; stroke-width: 2.5; }
    .peak { fill: #fff; }
    .tag { fill: #f2f4ff; font: 600 12px system-ui, sans-serif; text-anchor: middle; }
  `,
})
export class CompassRose {
  readonly pass = input.required<PassDetails>();

  private xy(az: number, el: number) {
    const r = 120 * (1 - Math.max(0, Math.min(90, el)) / 90);
    const a = (az * Math.PI) / 180;
    return { x: 150 + r * Math.sin(a), y: 150 - r * Math.cos(a) };
  }
  readonly pts = computed(() => {
    const p = this.pass();
    return { start: this.xy(p.start.az, p.start.el), peak: this.xy(p.peak.az, p.peak.el), end: this.xy(p.end.az, p.end.el) };
  });
  /** Curva que passa pelos três pontos (esquema, não trajetória exata). */
  readonly path = computed(() => {
    const { start: s, peak: k, end: e } = this.pts();
    const cx = 2 * k.x - (s.x + e.x) / 2;
    const cy = 2 * k.y - (s.y + e.y) / 2;
    return `M${s.x.toFixed(1)} ${s.y.toFixed(1)} Q${cx.toFixed(1)} ${cy.toFixed(1)} ${e.x.toFixed(1)} ${e.y.toFixed(1)}`;
  });
  readonly label = computed(() => {
    const p = this.pass();
    return `Mapa do céu: começa a ${compassDirection(p.start.az)}, ${describeElevation(p.start.el)}; ponto mais alto a ${compassDirection(p.peak.az)}, ${describeElevation(p.peak.el)}; termina a ${compassDirection(p.end.az)}.`;
  });
}
