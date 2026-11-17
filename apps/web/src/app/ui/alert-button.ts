import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Push } from '../core/push';
import { Store } from '../core/store';

/** "Me avise": o único lugar que pede permissão de notificação, e só depois do toque. */
@Component({
  selector: 'app-alert-button',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @switch (push.state()) {
      @case ('on') { <p class="on"><span aria-hidden="true">🔔</span> Alertas ativados. Você recebe um aviso {{ lead() }} minutos antes das boas passagens.</p> }
      @case ('off') { <button class="btn primary block" (click)="push.enable()">Me avise quando houver algo bom</button> }
      @case ('working') { <button class="btn primary block" disabled>Ativando…</button> }
      @case ('denied') { <p class="muted small">As notificações estão bloqueadas para este site. Para receber alertas, libere nas configurações do navegador.</p> }
      @case ('needs-install') {
        <button class="btn primary block" (click)="showGuide.set(!showGuide())" [attr.aria-expanded]="showGuide()">Me avise quando houver algo bom</button>
        @if (showGuide()) {
          <div class="guide fade">
            <p><strong>No iPhone, falta um passo.</strong> Os alertas só funcionam com o app na Tela de Início:</p>
            <ol>
              <li>Toque em <strong>Compartilhar</strong> (o quadrado com a seta) na barra do Safari.</li>
              <li>Escolha <strong>Adicionar à Tela de Início</strong>.</li>
              <li>Abra o <strong>Céu de SP</strong> pelo ícone novo e toque em “Me avise” de novo.</li>
            </ol>
          </div>
        }
      }
      @case ('unsupported') { <p class="muted small">Este navegador não recebe alertas. O app funciona normalmente; os avisos precisam do Chrome, Edge, Firefox ou Safari atualizados.</p> }
    }
    @if (push.error(); as err) { <p class="err small" role="alert">{{ err }}</p> }
  `,
  styles: `
    :host { display: block; }
    .on { color: var(--good); font-weight: 600; }
    .guide { margin-top: 12px; padding: 14px; border: 1px dashed var(--line); border-radius: 14px; }
    ol { margin: 10px 0 0; padding-left: 20px; } li + li { margin-top: 6px; }
    .err { color: var(--danger); margin-top: 8px; }
  `,
})
export class AlertButton {
  readonly push = inject(Push);
  private readonly store = inject(Store);
  readonly showGuide = signal(false);
  readonly lead = computed(() => this.store.prefs().leadMinutes);
}
