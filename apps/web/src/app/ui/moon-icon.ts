import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Desenho da fase. No hemisfério sul a Lua crescente fica iluminada pelo lado ESQUERDO. */
@Component({
  selector: 'app-moon-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <circle cx="50" cy="50" r="46" fill="#232b55" />
      <path [attr.d]="lit()" fill="#f4efdc" />
      <circle cx="50" cy="50" r="46" fill="none" stroke="#4a568f" stroke-width="1.5" />
    </svg>
  `,
  styles: `:host { display: block; } svg { width: 100%; height: auto; display: block; }`,
})
export class MoonIcon {
  readonly fraction = input.required<number>();
  readonly waxing = input.required<boolean>();

  readonly lit = computed(() => {
    const f = Math.max(0, Math.min(1, this.fraction()));
    const R = 46;
    const rx = (R * Math.abs(1 - 2 * f)).toFixed(2);
    const left = this.waxing();
    // meia-lua do lado iluminado + elipse do terminador
    const outer = left ? 0 : 1;
    const inner = f > 0.5 ? outer : 1 - outer;
    return `M50 ${50 - R} A${R} ${R} 0 0 ${outer} 50 ${50 + R} A${rx} ${R} 0 0 ${inner} 50 ${50 - R}Z`;
  });
}
