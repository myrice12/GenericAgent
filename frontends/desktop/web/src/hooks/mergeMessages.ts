/**
 * Bridge message field map (from desktop_bridge.add_message / messages() + app.js normalize):
 *
 * Stored message:
 *   id: number          — sess.msg_seq, monotonic
 *   role: string        — 'user' | 'assistant' | 'error' | 'system'
 *   content: string     — body text (assistant may also use turn_segs)
 *   ts: number          — unix seconds
 *   display?: string    — user-facing text when prompt ≠ display
 *   stopped?: boolean   — cancel mid-stream
 *   images?: unknown[]  — image metas [{name,path}]
 *   files?: unknown[]   — file metas [{name,path}]
 *   turn_segs?: string[]— assistant per-turn segments (authoritative when present)
 *   curr_turn?: number  — visible turn index
 *
 * Poll GET /session/{sid}/messages?after=&limit=:
 *   { sessionId, status, messages, partial, plan, msgSeq, updatedAt, lastError, model }
 *   partial: same shape + { partial: true } while streaming
 *
 * Prompt POST body (prompt_handler):
 *   { prompt, display?, llmNo?, files?, imageMetas?, images? }
 * Response: { ok, sessionId, accepted, userMessageId, seq }
 */

export type ChatMessage = {
  id: number;
  role: string;
  content: string;
  display?: string;
  stopped?: boolean;
  partial?: boolean;
  turn_segs?: string[];
  curr_turn?: number;
  ts?: number;
  images?: unknown[];
  files?: unknown[];
};

function asRecord(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== 'object') return null;
  return raw as Record<string, unknown>;
}

export function normalizeMessage(raw: unknown): ChatMessage | null {
  const m = asRecord(raw);
  if (!m) return null;
  const id = Number(m.id ?? 0);
  if (!id) return null;
  const role = typeof m.role === 'string' && m.role ? m.role : 'system';
  const content = typeof m.content === 'string' ? m.content : String(m.content ?? '');
  const out: ChatMessage = { id, role, content };
  if (typeof m.display === 'string' && m.display.length) out.display = m.display;
  if (m.stopped) out.stopped = true;
  if (m.partial) out.partial = true;
  if (Array.isArray(m.turn_segs)) out.turn_segs = m.turn_segs.map(String);
  if (typeof m.curr_turn === 'number') out.curr_turn = m.curr_turn;
  if (typeof m.ts === 'number') out.ts = m.ts;
  if (m.images) out.images = m.images as unknown[];
  if (m.files) out.files = m.files as unknown[];
  return out;
}

export function messageText(m: ChatMessage): string {
  if (typeof m.display === 'string' && m.display.length) return m.display;
  if (Array.isArray(m.turn_segs) && m.turn_segs.length) {
    const i =
      typeof m.curr_turn === 'number'
        ? m.curr_turn
        : Math.max(0, m.turn_segs.length - 1);
    return m.turn_segs[i] ?? m.turn_segs[m.turn_segs.length - 1] ?? m.content;
  }
  return m.content;
}

export function mergeMessages(
  prev: ChatMessage[],
  lastId: number,
  incoming: unknown[],
): { messages: ChatMessage[]; lastId: number } {
  const seen = new Set(prev.map((m) => m.id));
  let nextId = lastId;
  const added: ChatMessage[] = [];
  for (const raw of incoming) {
    const m = normalizeMessage(raw);
    if (!m || seen.has(m.id)) continue;
    seen.add(m.id);
    added.push(m);
    nextId = Math.max(nextId, m.id);
  }
  if (!added.length) return { messages: prev, lastId: nextId };
  return { messages: [...prev, ...added], lastId: nextId };
}

export type PollResultLike = {
  status?: string;
  messages?: unknown[];
  partial?: unknown | null;
};

export function applyPollResult(
  prev: ChatMessage[],
  lastId: number,
  result: PollResultLike,
): {
  messages: ChatMessage[];
  lastId: number;
  partial: ChatMessage | null;
  isRunning: boolean;
} {
  const merged = mergeMessages(prev, lastId, result.messages ?? []);
  let partial: ChatMessage | null = null;
  if (result.partial) {
    const p = normalizeMessage(result.partial);
    if (p) partial = { ...p, partial: true };
    else {
      const rec = asRecord(result.partial);
      if (rec) {
        partial = {
          id: Number(rec.id ?? 0) || -1,
          role: typeof rec.role === 'string' ? rec.role : 'assistant',
          content: typeof rec.content === 'string' ? rec.content : '',
          partial: true,
          turn_segs: Array.isArray(rec.turn_segs) ? rec.turn_segs.map(String) : undefined,
          curr_turn: typeof rec.curr_turn === 'number' ? rec.curr_turn : undefined,
        };
      }
    }
  }
  const isRunning = result.status === 'running' || !!partial;
  return {
    messages: merged.messages,
    lastId: merged.lastId,
    partial,
    isRunning,
  };
}
