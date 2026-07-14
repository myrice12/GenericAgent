import { httpJson } from './http';
import { bridgeOrigin } from './ports';

type JsonBody = Record<string, unknown> | unknown[] | string | null | undefined;

type HttpInit = Omit<RequestInit, 'body'> & { body?: JsonBody | BodyInit | null };

function withQuery(
  path: string,
  query?: Record<string, string | number | boolean | undefined | null>,
): string {
  const base = `${bridgeOrigin()}${path}`;
  if (!query) return base;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null) continue;
    params.set(k, String(v));
  }
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

function call<T = unknown>(path: string, init?: HttpInit): Promise<T> {
  return httpJson<T>(`${bridgeOrigin()}${path}`, init as RequestInit);
}

export function getStatus() {
  return call('/status');
}

export function listSessions() {
  return call('/sessions');
}

export function newSession(body?: Record<string, unknown>) {
  return call('/session/new', { method: 'POST', body: body ?? {} });
}

export function deleteSession(sid: string) {
  return call(`/session/${encodeURIComponent(sid)}`, { method: 'DELETE' });
}

export function getMessages(sid: string, after: string | number = 0, limit: number = 200) {
  return httpJson(
    withQuery(`/session/${encodeURIComponent(sid)}/messages`, { after, limit }),
  );
}

export function prompt(sid: string, body: Record<string, unknown>) {
  return call(`/session/${encodeURIComponent(sid)}/prompt`, {
    method: 'POST',
    body,
  });
}

export function cancel(sid: string, body?: Record<string, unknown>) {
  return call(`/session/${encodeURIComponent(sid)}/cancel`, {
    method: 'POST',
    body: body ?? {},
  });
}

export function listModelProfiles() {
  return call('/model-profiles');
}

export function getModelProfile(id: number) {
  return call(`/model-profiles/${id}`);
}

export function addModelProfile(body: Record<string, unknown>) {
  return call('/model-profiles', { method: 'POST', body });
}

export function updateModelProfile(id: number, body: Record<string, unknown>) {
  return call(`/model-profiles/${id}`, { method: 'PUT', body });
}

export function deleteModelProfile(id: number) {
  return call(`/model-profiles/${id}`, { method: 'DELETE', body: {} });
}

export function addToMixin(id: number) {
  return call(`/model-profiles/${id}/mixin`, { method: 'POST', body: {} });
}

export function removeFromMixin(id: number) {
  return call(`/model-profiles/${id}/mixin`, { method: 'DELETE', body: {} });
}

export function getMykey() {
  return call<{ content?: string; path?: string }>('/services/mykey');
}

export function saveMykey(content: string) {
  return call('/services/mykey', { method: 'POST', body: { content } });
}

export function servicesPanel() {
  return call('/services/panel');
}

export function serviceStart(id: string) {
  return call('/services/start', { method: 'POST', body: { id } });
}

export function serviceStop(id: string) {
  return call('/services/stop', { method: 'POST', body: { id } });
}

export function tokenStats(query?: Record<string, string | number | boolean | undefined | null>) {
  return httpJson(withQuery('/token-stats', query));
}

export function tokenHistory(query?: Record<string, string | number | boolean | undefined | null>) {
  return httpJson(withQuery('/token-history', query));
}

/** POST /token-history — persist usage deltas + conductor totals */
export function postTokenHistory(body: Record<string, unknown>) {
  return call('/token-history', { method: 'POST', body });
}
