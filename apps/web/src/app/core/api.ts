import { Injectable } from '@angular/core';
import type { EventsResponse, Prefs } from './models';

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  if (!res.ok) throw new Error(`${res.status}`);
  return (res.status === 204 ? undefined : await res.json()) as T;
}
const jsonInit = (method: string, body: unknown, secret?: string): RequestInit => ({
  method,
  headers: { 'content-type': 'application/json', ...(secret ? { authorization: `Bearer ${secret}` } : {}) },
  body: JSON.stringify(body),
});

@Injectable({ providedIn: 'root' })
export class Api {
  config() { return http<{ vapidPublicKey: string | null }>('/api/config'); }
  events(cellId: string) { return http<EventsResponse>(`/api/cells/${encodeURIComponent(cellId)}/events`); }
  subscribe(sub: PushSubscriptionJSON, cellId: string, prefs: Prefs) {
    return http<{ id: string; secret: string }>('/api/subscriptions', jsonInit('POST', { endpoint: sub.endpoint, keys: sub.keys, cellId, prefs }));
  }
  update(id: string, secret: string, cellId: string, prefs: Prefs) {
    return http<{ ok: boolean }>(`/api/subscriptions/${id}`, jsonInit('PATCH', { cellId, prefs }, secret));
  }
  unsubscribe(id: string, secret: string) {
    return http<void>(`/api/subscriptions/${id}`, { method: 'DELETE', headers: { authorization: `Bearer ${secret}` } });
  }
  feedback(id: string, secret: string, eventId: string, saw: boolean, reason?: string) {
    return http<{ ok: boolean }>('/api/feedback', jsonInit('POST', { eventId, subscriptionId: id, saw, reason }, secret));
  }
}
