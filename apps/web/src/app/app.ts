import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Store } from './core/store';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <router-outlet />
    @if (store.cellId()) {
      <nav class="tabs" aria-label="Principal">
        <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }" ariaCurrentWhenActive="page"><span aria-hidden="true">✦</span>Hoje</a>
        <a routerLink="/calendario" routerLinkActive="active" ariaCurrentWhenActive="page"><span aria-hidden="true">☾</span>Lua</a>
        <a routerLink="/eclipse" routerLinkActive="active" ariaCurrentWhenActive="page"><span aria-hidden="true">☀</span>Eclipse</a>
        <a routerLink="/ajustes" routerLinkActive="active" ariaCurrentWhenActive="page"><span aria-hidden="true">⚙</span>Ajustes</a>
      </nav>
    }
  `,
  styles: `
    .tabs {
      position: fixed; left: 0; right: 0; bottom: 0; display: flex; justify-content: center; gap: 4px;
      padding: 8px 12px calc(8px + env(safe-area-inset-bottom));
      background: rgba(10, 14, 31, .92); backdrop-filter: blur(12px); border-top: 1px solid var(--line);
    }
    .tabs a {
      flex: 1; max-width: 130px; min-height: 52px; display: flex; flex-direction: column; align-items: center; justify-content: center;
      font-size: 12px; font-weight: 650; text-decoration: none; color: var(--ink-3); border-radius: 12px;
    }
    .tabs a span { font-size: 20px; line-height: 1.1; }
    .tabs a.active { color: var(--amber); background: var(--night-2); }
  `,
})
export class App {
  readonly store = inject(Store);
}
