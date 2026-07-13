import { useCallback, useEffect, useRef, useState } from 'react';
import * as bridge from '../api/bridge';
import {
  applyPollResult,
  type ChatMessage,
} from './mergeMessages';

const POLL_MS = 700;

export type UseSessionMessagesOptions = {
  llmNo?: number;
};

export type UseSessionMessagesResult = {
  messages: ChatMessage[];
  partial: ChatMessage | null;
  isRunning: boolean;
  error: string | null;
  send: (text: string) => Promise<boolean>;
  stop: () => Promise<boolean>;
};

type MessagesPayload = {
  status?: string;
  messages?: unknown[];
  partial?: unknown | null;
};

/**
 * Field map: see mergeMessages.ts header comment (Bridge + app.js).
 */
export function useSessionMessages(
  sid: string | null,
  opts: UseSessionMessagesOptions = {},
): UseSessionMessagesResult {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [partial, setPartial] = useState<ChatMessage | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastIdRef = useRef(0);
  const llmNoRef = useRef(opts.llmNo);
  llmNoRef.current = opts.llmNo;

  useEffect(() => {
    setMessages([]);
    setPartial(null);
    setIsRunning(false);
    setError(null);
    lastIdRef.current = 0;
    if (!sid) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const messagesRef = { current: [] as ReturnType<typeof applyPollResult>['messages'] };

    const tick = async () => {
      try {
        const raw = (await bridge.getMessages(
          sid,
          lastIdRef.current,
          200,
        )) as MessagesPayload;
        if (cancelled) return;
        const out = applyPollResult(messagesRef.current, lastIdRef.current, raw);
        messagesRef.current = out.messages;
        lastIdRef.current = out.lastId;
        setMessages(out.messages);
        setPartial(out.partial);
        setIsRunning(out.isRunning);
        setError(null);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
        }
      } finally {
        if (!cancelled) {
          timer = setTimeout(tick, POLL_MS);
        }
      }
    };

    void tick();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [sid]);

  const send = useCallback(
    async (text: string): Promise<boolean> => {
      const trimmed = text.trim();
      if (!trimmed || !sid) return false;
      try {
        const body: Record<string, unknown> = {
          prompt: trimmed,
          display: trimmed,
        };
        if (llmNoRef.current != null) body.llmNo = llmNoRef.current;
        await bridge.prompt(sid, body);
        setIsRunning(true);
        setError(null);
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        return false;
      }
    },
    [sid],
  );

  const stop = useCallback(async (): Promise<boolean> => {
    if (!sid) return false;
    try {
      await bridge.cancel(sid);
      setError(null);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return false;
    }
  }, [sid]);

  return { messages, partial, isRunning, error, send, stop };
}
