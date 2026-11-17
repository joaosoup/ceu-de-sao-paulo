import { Injectable, computed, inject, signal } from '@angular/core';
import { SwPush } from '@angular/service-worker';
import { Api } from './api';
import { Store } from './store';

export type PushState = 'unsupported' | 'needs-install' | 'off' | 'on' | 'denied' | 'working';

/** iPhone/iPad: push na web só funciona com o app adicionado à Tela de Início (iOS 16.4+). */
const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isStandalone = () => matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;

@Injectable({ providedIn: 'root' })
export class Push {
  private readonly sw = inject(SwPush);
  private readonly api = inject(Api);
  private readonly store = inject(Store);
  private readonly busy = signal(false);
  private readonly permission = signal<NotificationPermission | 'none'>(typeof Notification === 'undefined' ? 'none' : Notification.permission);
  readonly error = signal<string | null>(null);

  readonly state = computed<PushState>(() => {
    if (this.busy()) return 'working';
    if (isIos() && !isStandalone()) return 'needs-install';
    if (!this.sw.isEnabled || this.permission() === 'none') return 'unsupported';
    if (this.permission() === 'denied') return 'denied';
    return this.store.subscription() ? 'on' : 'off';
  });

  /** Chamado só depois do toque em "Me avise": pedido de permissão sem contexto costuma ser negado. */
  async enable(): Promise<void> {
    const cell = this.store.cellId();
    if (!cell) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      const { vapidPublicKey } = await this.api.config();
      if (!vapidPublicKey) throw new Error('servidor sem chave de push');
      const sub = await this.sw.requestSubscription({ serverPublicKey: vapidPublicKey });
      this.permission.set(Notification.permission);
      this.store.setSubscription(await this.api.subscribe(sub.toJSON(), cell, this.store.prefs()));
    } catch {
      this.permission.set(typeof Notification === 'undefined' ? 'none' : Notification.permission);
      this.error.set(this.permission() === 'denied' ? null : 'Não foi possível ativar os alertas agora. Tente de novo em instantes.');
    } finally {
      this.busy.set(false);
    }
  }

  /** Mudou de local ou de preferências: o servidor precisa saber. */
  async sync(): Promise<void> {
    const s = this.store.subscription();
    const cell = this.store.cellId();
    if (!s || !cell) return;
    try { await this.api.update(s.id, s.secret, cell, this.store.prefs()); }
    catch { this.error.set('Não foi possível salvar no servidor. Suas preferências valem assim que a conexão voltar.'); }
  }

  /** Apaga a inscrição no servidor e no navegador. */
  async disable(): Promise<void> {
    const s = this.store.subscription();
    this.busy.set(true);
    try {
      if (s) await this.api.unsubscribe(s.id, s.secret).catch(() => undefined);
      if (this.sw.isEnabled) await this.sw.unsubscribe().catch(() => undefined);
      this.store.setSubscription(null);
    } finally {
      this.busy.set(false);
    }
  }
}
