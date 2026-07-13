import { bridgeWsOrigin } from './ports';

export type BridgeWsMessage = {
  type: string;
  [key: string]: unknown;
};

export type BridgeWsHandler = (msg: BridgeWsMessage) => void;

const handlers = new Set<BridgeWsHandler>();
let ws: WebSocket | null = null;
let cachedBridgeReady: BridgeWsMessage | null = null;

function emit(msg: BridgeWsMessage) {
  if (msg.type === 'bridge-ready') cachedBridgeReady = msg;
  for (const handler of Array.from(handlers)) {
    try {
      handler(msg);
    } catch (err) {
      console.error('[bridgeWs] handler error', err);
    }
  }
}

function dispatch(msg: BridgeWsMessage) {
  // Known types from desktop_bridge / app.js: services.snapshot, service.changed,
  // session-state, bridge-ready (plus bridge-log / bridge-error).
  emit(msg);
}

export function subscribe(handler: BridgeWsHandler): () => void {
  handlers.add(handler);
  if (cachedBridgeReady) {
    try {
      handler(cachedBridgeReady);
    } catch (err) {
      console.error('[bridgeWs] replay bridge-ready', err);
    }
  }
  return () => {
    handlers.delete(handler);
  };
}

export function connect(): void {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
    return;
  }
  const url = `${bridgeWsOrigin()}/ws`;
  try {
    ws = new WebSocket(url);
  } catch (err) {
    emit({
      type: 'bridge-error',
      message: err instanceof Error ? err.message : String(err),
    });
    return;
  }
  ws.addEventListener('message', (ev) => {
    let msg: BridgeWsMessage;
    try {
      msg = JSON.parse(String(ev.data)) as BridgeWsMessage;
    } catch {
      return;
    }
    if (!msg || typeof msg.type !== 'string') return;
    dispatch(msg);
  });
  ws.addEventListener('close', () => {
    emit({ type: 'bridge-closed', reason: 'ws-closed' });
  });
  ws.addEventListener('error', () => {
    emit({ type: 'ws-error', message: 'WebSocket error' });
  });
}

export function disconnect(): void {
  if (!ws) return;
  const sock = ws;
  ws = null;
  try {
    sock.close();
  } catch {
    /* ignore */
  }
}
