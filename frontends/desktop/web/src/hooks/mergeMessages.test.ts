import { describe, it, expect } from 'vitest';
import {
  normalizeMessage,
  mergeMessages,
  applyPollResult,
  messageText,
} from './mergeMessages';

describe('normalizeMessage', () => {
  it('maps bridge fields id/role/content/ts', () => {
    const m = normalizeMessage({
      id: 3,
      role: 'user',
      content: '你好',
      ts: 1710000000,
      display: '你好',
    });
    expect(m).toEqual({
      id: 3,
      role: 'user',
      content: '你好',
      ts: 1710000000,
      display: '你好',
    });
  });

  it('keeps assistant turn_segs and content fallback', () => {
    const m = normalizeMessage({
      id: 4,
      role: 'assistant',
      content: 'fallback',
      turn_segs: ['a', 'b'],
      curr_turn: 1,
    });
    expect(m?.turn_segs).toEqual(['a', 'b']);
    expect(m?.curr_turn).toBe(1);
    expect(m?.content).toBe('fallback');
  });

  it('returns null for missing id', () => {
    expect(normalizeMessage({ role: 'user', content: 'x' })).toBeNull();
  });
});

describe('mergeMessages', () => {
  it('appends only newer ids and advances lastId', () => {
    const prev = [
      { id: 1, role: 'user', content: 'hi' },
      { id: 2, role: 'assistant', content: 'yo' },
    ];
    const { messages, lastId } = mergeMessages(prev, 2, [
      { id: 2, role: 'assistant', content: 'yo' },
      { id: 3, role: 'assistant', content: 'next' },
    ]);
    expect(lastId).toBe(3);
    expect(messages.map((m) => m.id)).toEqual([1, 2, 3]);
    expect(messages[2].content).toBe('next');
  });

  it('skips duplicates already present', () => {
    const prev = [{ id: 1, role: 'user', content: 'hi' }];
    const { messages, lastId } = mergeMessages(prev, 1, [
      { id: 1, role: 'user', content: 'hi' },
    ]);
    expect(messages).toHaveLength(1);
    expect(lastId).toBe(1);
  });
});

describe('applyPollResult', () => {
  it('merges messages and derives isRunning from status/partial', () => {
    const out = applyPollResult(
      [],
      0,
      {
        status: 'running',
        messages: [{ id: 1, role: 'user', content: 'q' }],
        partial: { id: 2, role: 'assistant', content: 'ans…', partial: true },
      },
    );
    expect(out.messages).toHaveLength(1);
    expect(out.lastId).toBe(1);
    expect(out.isRunning).toBe(true);
    expect(out.partial?.content).toBe('ans…');
  });

  it('clears running when idle and no partial', () => {
    const out = applyPollResult(
      [{ id: 1, role: 'user', content: 'q' }],
      1,
      { status: 'idle', messages: [], partial: null },
    );
    expect(out.isRunning).toBe(false);
    expect(out.partial).toBeNull();
  });
});

describe('messageText', () => {
  it('prefers display for user, turn_segs for assistant', () => {
    expect(
      messageText({ id: 1, role: 'user', content: 'raw', display: 'shown' }),
    ).toBe('shown');
    expect(
      messageText({
        id: 2,
        role: 'assistant',
        content: '',
        turn_segs: ['seg0', 'seg1'],
        curr_turn: 1,
      }),
    ).toBe('seg1');
  });
});
