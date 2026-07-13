/**
 * Conductor (:8900) client — paths taken from frontends/desktop/static/app.js
 * (CONDUCTOR_ORIGIN / CONDUCTOR_WS_ORIGIN) and frontends/conductor.py.
 */
import { httpJson } from './http';
import { conductorOrigin, conductorWsOrigin } from './ports';

type JsonBody = Record<string, unknown> | unknown[] | string | null | undefined;
type HttpInit = Omit<RequestInit, 'body'> & { body?: JsonBody | BodyInit | null };

function call<T = unknown>(path: string, init?: HttpInit): Promise<T> {
  return httpJson<T>(`${conductorOrigin()}${path}`, init as RequestInit);
}

/** GET /token-stats — used by usage page via CONDUCTOR_ORIGIN */
export function tokenStats() {
  return call('/token-stats');
}

/** GET /subagent — list subagents */
export function listSubagents() {
  return call('/subagent');
}

/** GET /subagent/{sid} */
export function getSubagent(sid: string, maxLen?: number) {
  const q = maxLen != null ? `?max_len=${encodeURIComponent(String(maxLen))}` : '';
  return call(`/subagent/${encodeURIComponent(sid)}${q}`);
}

/** POST /subagent/{sid} — e.g. { action: 'kill' } from collab card menu */
export function subagentAction(sid: string, body: Record<string, unknown>) {
  return call(`/subagent/${encodeURIComponent(sid)}`, {
    method: 'POST',
    body,
  });
}

/** Convenience: kill subagent (app.js collab context menu) */
export function killSubagent(sid: string) {
  return subagentAction(sid, { action: 'kill' });
}

/** GET /chat */
export function getChat() {
  return call('/chat');
}

/** POST /chat */
export function postChat(body: Record<string, unknown>) {
  return call('/chat', { method: 'POST', body });
}

export type ConductorWsHandler = (data: Record<string, unknown>) => void;

let ws: WebSocket | null = null;
const wsHandlers = new Set<ConductorWsHandler>();

export function conductorWsUrl(): string {
  return `${conductorWsOrigin()}/ws`;
}

export function subscribeWs(handler: ConductorWsHandler): () => void {
  wsHandlers.add(handler);
  return () => {
    wsHandlers.delete(handler);
  };
}

export function connectWs(): void {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
    return;
  }
  try {
    ws = new WebSocket(conductorWsUrl());
  } catch {
    return;
  }
  ws.addEventListener('message', (ev) => {
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(String(ev.data)) as Record<string, unknown>;
    } catch {
      return;
    }
    for (const h of Array.from(wsHandlers)) {
      try {
        h(data);
      } catch (err) {
        console.error('[conductorWs] handler error', err);
      }
    }
  });
}

export function disconnectWs(): void {
  if (!ws) return;
  const sock = ws;
  ws = null;
  try {
    sock.close();
  } catch {
    /* ignore */
  }
}

export function sendWs(payload: Record<string, unknown>): boolean {
  if (!ws || ws.readyState !== WebSocket.OPEN) return false;
  ws.send(JSON.stringify(payload));
  return true;
}
