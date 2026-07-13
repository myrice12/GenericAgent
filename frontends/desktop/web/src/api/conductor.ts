/**
 * Conductor (:8900) client — paths taken from frontends/desktop/static/app.js
 * (CONDUCTOR_ORIGIN / CONDUCTOR_WS_ORIGIN) and frontends/conductor.py.
 *
 * Collab WS flow (app.js ~5760–6182):
 *   connect → hello {subagents, chat, running}
 *   events: subagents {items}, chat {item}
 *   send: { msg, files?, images? }
 * Subagent stop: conductor.py accepts action abort|stop (app.js historically sent kill).
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

/** POST /subagent/{sid} — body.action per conductor.py */
export function subagentAction(sid: string, body: Record<string, unknown>) {
  return call(`/subagent/${encodeURIComponent(sid)}`, {
    method: 'POST',
    body,
  });
}

/**
 * Abort/stop a subagent.
 * conductor.py api_subagent_action: action in ("abort", "stop") → agent.abort().
 * app.js collab card menu used { action: 'kill' }, which the server rejects (400).
 */
export function abortSubagent(sid: string) {
  return subagentAction(sid, { action: 'abort' });
}

/** @deprecated Prefer abortSubagent — kill is not a valid conductor action */
export function killSubagent(sid: string) {
  return abortSubagent(sid);
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
export type ConductorConnState = 'connecting' | 'open' | 'closed';
export type ConductorConnHandler = (state: ConductorConnState) => void;

let ws: WebSocket | null = null;
const wsHandlers = new Set<ConductorWsHandler>();
const connHandlers = new Set<ConductorConnHandler>();
let connState: ConductorConnState = 'closed';

function setConnState(state: ConductorConnState) {
  connState = state;
  for (const h of Array.from(connHandlers)) {
    try {
      h(state);
    } catch (err) {
      console.error('[conductorWs] conn handler error', err);
    }
  }
}

export function getConnState(): ConductorConnState {
  return connState;
}

export function isWsOpen(): boolean {
  return !!ws && ws.readyState === WebSocket.OPEN;
}

export function conductorWsUrl(): string {
  return `${conductorWsOrigin()}/ws`;
}

export function subscribeWs(handler: ConductorWsHandler): () => void {
  wsHandlers.add(handler);
  return () => {
    wsHandlers.delete(handler);
  };
}

export function subscribeConn(handler: ConductorConnHandler): () => void {
  connHandlers.add(handler);
  return () => {
    connHandlers.delete(handler);
  };
}

export function connectWs(): void {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
    return;
  }
  setConnState('connecting');
  let sock: WebSocket;
  try {
    sock = new WebSocket(conductorWsUrl());
  } catch {
    ws = null;
    setConnState('closed');
    return;
  }
  ws = sock;
  sock.addEventListener('open', () => {
    if (ws !== sock) return;
    setConnState('open');
  });
  sock.addEventListener('close', () => {
    if (ws !== sock) return;
    ws = null;
    setConnState('closed');
  });
  sock.addEventListener('error', () => {
    /* close event follows; avoid double-scheduling */
  });
  sock.addEventListener('message', (ev) => {
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
  if (!ws) {
    if (connState !== 'closed') setConnState('closed');
    return;
  }
  const sock = ws;
  ws = null;
  try {
    sock.close();
  } catch {
    /* ignore */
  }
  setConnState('closed');
}

export function sendWs(payload: Record<string, unknown>): boolean {
  if (!ws || ws.readyState !== WebSocket.OPEN) return false;
  ws.send(JSON.stringify(payload));
  return true;
}
