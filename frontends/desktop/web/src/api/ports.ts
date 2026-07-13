export const BRIDGE_PORT = 14168;
export const CONDUCTOR_PORT = 8900;

function hostOrigin(port: number): string {
  if (typeof location !== 'undefined' && location.protocol && location.hostname) {
    return `${location.protocol}//${location.hostname}:${port}`;
  }
  return `http://127.0.0.1:${port}`;
}

export const bridgeOrigin = () => hostOrigin(BRIDGE_PORT);
export const conductorOrigin = () => hostOrigin(CONDUCTOR_PORT);

export function bridgeWsOrigin(): string {
  if (typeof location !== 'undefined' && location.hostname) {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${location.hostname}:${BRIDGE_PORT}`;
  }
  return `ws://127.0.0.1:${BRIDGE_PORT}`;
}

export function conductorWsOrigin(): string {
  if (typeof location !== 'undefined' && location.hostname) {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${location.hostname}:${CONDUCTOR_PORT}`;
  }
  return `ws://127.0.0.1:${CONDUCTOR_PORT}`;
}
