import { describe, it, expect, vi, beforeEach } from 'vitest';
import { httpJson } from './http';

describe('httpJson', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('GETs JSON and returns parsed body', async () => {
    vi.stubGlobal('fetch', vi.fn(async () =>
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    ));
    const data = await httpJson<{ ok: boolean }>('http://127.0.0.1:14168/status');
    expect(data.ok).toBe(true);
    expect(fetch).toHaveBeenCalledWith(
      'http://127.0.0.1:14168/status',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('throws with status on non-2xx', async () => {
    vi.stubGlobal('fetch', vi.fn(async () =>
      new Response(JSON.stringify({ error: 'nope' }), { status: 500 }),
    ));
    await expect(httpJson('http://127.0.0.1:14168/x')).rejects.toThrow(/nope|500/);
  });
});
