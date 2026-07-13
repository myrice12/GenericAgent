import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as bridge from './bridge';

describe('bridge client', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('lists sessions via GET /sessions', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      expect(String(url)).toContain('/sessions');
      return new Response(JSON.stringify({ sessions: [] }), { status: 200 });
    }));
    const data = await bridge.listSessions();
    expect(data).toEqual({ sessions: [] });
  });

  it('creates session via POST /session/new', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        expect(String(url)).toContain('/session/new');
        expect(init?.method).toBe('POST');
        return new Response(JSON.stringify({ id: 's1' }), { status: 200 });
      }),
    );
    const data = await bridge.newSession({ title: 't' });
    expect(data).toEqual({ id: 's1' });
  });

  it('prompts via POST /session/{sid}/prompt', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        expect(String(url)).toContain('/session/abc/prompt');
        expect(init?.method).toBe('POST');
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }),
    );
    const data = await bridge.prompt('abc', { text: 'hi' });
    expect(data).toEqual({ ok: true });
  });
});
