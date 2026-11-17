import { inject } from '@angular/core';
import { Router, type CanActivateFn, type Routes } from '@angular/router';
import { Store } from './core/store';

/** Sem local escolhido, a única tela possível é a de boas-vindas. */
const needsLocation: CanActivateFn = () => (inject(Store).cellId() ? true : inject(Router).parseUrl('/inicio'));

export const routes: Routes = [
  { path: 'inicio', title: 'Onde você está? · O Céu de São Paulo', loadComponent: () => import('./pages/welcome').then((m) => m.Welcome) },
  { path: '', pathMatch: 'full', title: 'Hoje à noite · O Céu de São Paulo', canActivate: [needsLocation], loadComponent: () => import('./pages/tonight').then((m) => m.Tonight) },
  { path: 'evento/:id', title: 'Passagem · O Céu de São Paulo', canActivate: [needsLocation], loadComponent: () => import('./pages/event').then((m) => m.EventPage) },
  { path: 'calendario', title: 'Lua e calendário · O Céu de São Paulo', canActivate: [needsLocation], loadComponent: () => import('./pages/calendar').then((m) => m.Calendar) },
  { path: 'eclipse', title: 'Eclipse solar · O Céu de São Paulo', canActivate: [needsLocation], loadComponent: () => import('./pages/eclipse').then((m) => m.Eclipse) },
  { path: 'ajustes', title: 'Ajustes · O Céu de São Paulo', canActivate: [needsLocation], loadComponent: () => import('./pages/settings').then((m) => m.Settings) },
  { path: '**', redirectTo: '' },
];
