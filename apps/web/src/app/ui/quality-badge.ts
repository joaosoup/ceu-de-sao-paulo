import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { SkyEvent } from '../core/models';
import { qualityOf } from '../core/quality';

/** Qualidade sempre com ícone e palavra, nunca só cor. */
@Component({
  selector: 'app-quality-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="badge" [class]="q().cls"><span aria-hidden="true">{{ icon() }}</span>{{ q().label }}</span>`,
})
export class QualityBadge {
  readonly event = input.required<SkyEvent>();
  readonly q = computed(() => qualityOf(this.event()));
  readonly icon = computed(() => ({ excelente: '★', boa: '●', dificil: '○', oculta: '○' })[this.q().cls]);
}
