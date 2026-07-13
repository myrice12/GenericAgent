import { useCallback, useEffect, useState, type ReactNode } from 'react';
import * as bridge from '../api/bridge';
import { Composer } from '../components/Composer';
import { MessageList } from '../components/MessageList';
import { useSessionMessages } from '../hooks/useSessionMessages';
import { t } from '../i18n';
import { SessionRail, type SessionItem } from '../layout/SessionRail';

type ModelProfile = {
  id: number;
  name?: string;
  kind?: string;
  active?: boolean;
  model?: string;
};

type ChatPageProps = {
  setRail: (node: ReactNode | null) => void;
};

function sessionFromRaw(raw: Record<string, unknown>): SessionItem {
  const id = String(raw.sessionId ?? raw.id ?? '');
  const title = String(raw.title ?? id);
  const status = raw.status != null ? String(raw.status) : undefined;
  return { id, title, status };
}

export function ChatPage({ setRail }: ChatPageProps) {
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<ModelProfile[]>([]);
  const [llmNo, setLlmNo] = useState(0);
  const [bootError, setBootError] = useState<string | null>(null);

  const { messages, partial, isRunning, error, send, stop } = useSessionMessages(
    activeId,
    { llmNo },
  );

  const refreshSessions = useCallback(async () => {
    try {
      const data = (await bridge.listSessions()) as {
        sessions?: Record<string, unknown>[];
        activeSessionId?: string | null;
      };
      const list = (data.sessions ?? []).map(sessionFromRaw).filter((s) => s.id);
      setSessions(list);
      setActiveId((cur) => {
        if (cur && list.some((s) => s.id === cur)) return cur;
        if (data.activeSessionId && list.some((s) => s.id === data.activeSessionId)) {
          return data.activeSessionId!;
        }
        return list[0]?.id ?? null;
      });
      setBootError(null);
    } catch (e) {
      setBootError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const refreshModels = useCallback(async () => {
    try {
      const data = (await bridge.listModelProfiles()) as {
        profiles?: ModelProfile[];
      };
      const list = data.profiles ?? [];
      setProfiles(list);
      const active = list.find((p) => p.active);
      if (active) setLlmNo(active.id);
      else if (list[0]) setLlmNo(list[0].id);
    } catch {
      /* Bridge may be offline — keep local state */
    }
  }, []);

  useEffect(() => {
    void refreshSessions();
    void refreshModels();
  }, [refreshSessions, refreshModels]);

  const onNew = useCallback(async () => {
    try {
      const data = (await bridge.newSession()) as {
        sessionId?: string;
        session?: Record<string, unknown>;
      };
      const id = String(data.sessionId ?? data.session?.id ?? '');
      await refreshSessions();
      if (id) setActiveId(id);
    } catch (e) {
      setBootError(e instanceof Error ? e.message : String(e));
    }
  }, [refreshSessions]);

  const onDelete = useCallback(
    async (id: string) => {
      try {
        await bridge.deleteSession(id);
        if (activeId === id) setActiveId(null);
        await refreshSessions();
      } catch (e) {
        setBootError(e instanceof Error ? e.message : String(e));
      }
    },
    [activeId, refreshSessions],
  );

  useEffect(() => {
    setRail(
      <SessionRail
        sessions={sessions}
        activeId={activeId}
        onSelect={setActiveId}
        onNew={() => void onNew()}
        onDelete={(id) => void onDelete(id)}
      />,
    );
    return () => setRail(null);
  }, [sessions, activeId, onNew, onDelete, setRail]);

  const activeTitle =
    sessions.find((s) => s.id === activeId)?.title ||
    activeId ||
    t('chat.noSession');

  const profileLabel = (p: ModelProfile) =>
    p.name || p.model || (p.kind === 'mixin' ? t('chat.modelMixin') : `#${p.id}`);

  return (
    <div className="chat-page">
      <header className="chat-topbar">
        <div className="chat-topbar-left">
          <h1 className="chat-title">{activeTitle}</h1>
          {profiles.length > 0 ? (
            <label className="model-pick">
              <span className="model-pick-label">{t('chat.model')}</span>
              <select
                value={llmNo}
                onChange={(e) => setLlmNo(Number(e.target.value))}
              >
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {profileLabel(p)}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
        <button
          type="button"
          className="btn-stop"
          disabled={!isRunning || !activeId}
          onClick={() => void stop()}
        >
          {t('chat.stop')}
        </button>
      </header>

      {(bootError || error) && (
        <div className="chat-error" role="alert">
          {bootError || error}
        </div>
      )}

      <div className="chat-body">
        {activeId ? (
          <MessageList messages={messages} partial={partial} />
        ) : (
          <div className="msg-empty">{t('chat.pickOrCreate')}</div>
        )}
      </div>

      <Composer disabled={!activeId} onSend={(text) => void send(text)} />
    </div>
  );
}
