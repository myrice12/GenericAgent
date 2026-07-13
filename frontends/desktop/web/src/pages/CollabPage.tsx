/**
 * Conductor collab page — sources from frontends/desktop/static/app.js
 *
 * Endpoints / behaviors (app.js collab IIFE ~5760–6182 + conductor.py):
 * - WS `${CONDUCTOR_WS_ORIGIN}/ws` — connect / hello / chat / subagents
 * - sendText → ws.send({ msg })  (composer + chips)
 * - POST /subagent/{sid} { action: 'abort' }  — stop worker
 *   (app.js showCardMenu used action:'kill'; conductor.py only accepts abort|stop)
 * - normalizeWorker / mapStatus / renderWorkers / syncRail / setConnUi /
 *   scheduleReconnect / collabInit / pushMsg
 * - i18n collab.* from app.js zh table → zh.ts
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as conductor from '../api/conductor';
import { Composer } from '../components/Composer';
import { t, type ZhKey } from '../i18n';

type WorkerStatus = 'running' | 'reported' | 'paused' | 'failed' | 'terminated';

type CollabMsg = {
  id: string;
  role: string;
  msg: string;
  ts?: number;
  _local?: boolean;
};

type Worker = {
  id: string;
  title: string;
  status: WorkerStatus;
  summary: string;
  fullReply: string;
  updatedAt?: number;
};

type RawSubagent = {
  id?: string;
  prompt?: string;
  reply?: string;
  status?: string;
  updated_at?: number;
};

const FAIL_MAX = 5;
const RECON_BASE = 1200;
const RECON_MAX = 30000;

const ST_KEYS: Record<WorkerStatus, ZhKey> = {
  running: 'collab.stRunning',
  reported: 'collab.stReported',
  paused: 'collab.stPaused',
  failed: 'collab.stFailed',
  terminated: 'collab.stTerminated',
};

const CHIPS: { key: ZhKey; labelKey: ZhKey }[] = [
  { key: 'collab.chipProgress', labelKey: 'collab.chipProgress' },
  { key: 'collab.chipPause', labelKey: 'collab.chipPause' },
  { key: 'collab.chipSummary', labelKey: 'collab.chipSummary' },
];

const GUIDE_STEPS: { t: ZhKey; d: ZhKey }[] = [
  { t: 'collab.guideStep1t', d: 'collab.guideStep1d' },
  { t: 'collab.guideStep2t', d: 'collab.guideStep2d' },
  { t: 'collab.guideStep3t', d: 'collab.guideStep3d' },
  { t: 'collab.guideStep4t', d: 'collab.guideStep4d' },
];

function mapStatus(status: string | undefined, reply: string | undefined): WorkerStatus {
  const r = (reply || '').trim();
  if (status === 'running') return 'running';
  if (status === 'failed') return 'failed';
  if (status === 'aborted') return 'terminated';
  if (status === 'stopped') return r ? 'reported' : 'paused';
  return 'paused';
}

function truncateTitle(prompt: string, fallback: string): string {
  let title = String(prompt ?? '')
    .replace(/^[\s请帮我麻烦]+/u, '')
    .trim();
  if (!title) return fallback;
  title = (title.split(/[\n。！？.!?]/)[0] || '').trim();
  if (title.length > 18) title = title.slice(0, 18) + '…';
  return title;
}

function normalizeWorker(raw: RawSubagent, titleSeq: Map<string, number>, nextSeq: () => number): Worker {
  const id = String(raw.id ?? '');
  if (!titleSeq.has(id)) titleSeq.set(id, nextSeq());
  const ui = mapStatus(raw.status, raw.reply);
  const title = truncateTitle(
    String(raw.prompt ?? ''),
    t('collab.taskFallback', { n: titleSeq.get(id)! }),
  );
  const reply = String(raw.reply || '')
    .replace(/\s+/g, ' ')
    .trim();
  const summary = reply
    ? reply.length > 80
      ? reply.slice(0, 80) + '…'
      : reply
    : t(ui === 'running' ? 'collab.summaryRunning' : 'collab.summaryWait');
  return {
    id,
    title,
    status: ui,
    summary,
    fullReply: raw.reply || '',
    updatedAt: raw.updated_at,
  };
}

function relTime(ts: number | undefined): string {
  if (!ts) return '';
  const ms = ts > 1e12 ? ts : ts * 1000;
  const sec = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (sec < 10) return t('collab.timeJust');
  if (sec < 60) return t('collab.timeSec', { n: sec });
  const min = Math.floor(sec / 60);
  if (min < 60) return t('collab.timeMin', { n: min });
  const hr = Math.floor(min / 60);
  return hr < 24
    ? t('collab.timeHr', { n: hr })
    : t('collab.timeDay', { n: Math.floor(hr / 24) });
}

function roleClass(role: string): string {
  if (role === 'user') return 'msg msg-user';
  if (role === 'conductor') return 'msg msg-assistant';
  if (role === 'error') return 'msg msg-error';
  return 'msg msg-system';
}

export function CollabPage() {
  const [messages, setMessages] = useState<CollabMsg[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [historyReady, setHistoryReady] = useState(false);
  const [conductorTyping, setConductorTyping] = useState(false);
  const [serviceAvailable, setServiceAvailable] = useState(false);
  const [everConnected, setEverConnected] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [failCount, setFailCount] = useState(0);
  const [reconnectInSec, setReconnectInSec] = useState(0);
  const [progressOpen, setProgressOpen] = useState(false);
  const [tick, setTick] = useState(0);
  const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null);

  const titleSeqRef = useRef(new Map<string, number>());
  const titleCounterRef = useRef(0);
  const localSeqRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectTickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectAtRef = useRef(0);
  const mountedRef = useRef(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  const applyWorkers = useCallback((rawList: unknown) => {
    const list = Array.isArray(rawList) ? (rawList as RawSubagent[]) : [];
    setWorkers(
      list
        .filter((r) => r && r.id)
        .map((r) =>
          normalizeWorker(r, titleSeqRef.current, () => ++titleCounterRef.current),
        ),
    );
  }, []);

  const pushMsg = useCallback((item: CollabMsg) => {
    setMessages((prev) => {
      if (item.id && prev.some((m) => m.id === item.id)) return prev;
      if (item.role === 'user') {
        const plain = item.msg.trim();
        for (let i = prev.length - 1; i >= 0; i--) {
          const m = prev[i];
          if (m._local && m.role === 'user' && m.msg.trim() === plain) {
            const next = prev.slice();
            next[i] = {
              ...m,
              id: item.id || m.id,
              ts: item.ts ?? m.ts,
              _local: false,
            };
            return next;
          }
        }
      }
      return [...prev, item];
    });
    if (item.role === 'conductor') setConductorTyping(false);
  }, []);

  const clearReconnectTimers = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (reconnectTickRef.current) {
      clearInterval(reconnectTickRef.current);
      reconnectTickRef.current = null;
    }
  }, []);

  const scheduleReconnect = useCallback(
    (nextFail: number, hadConnected: boolean) => {
      clearReconnectTimers();
      if (!hadConnected && nextFail >= FAIL_MAX) {
        setReconnecting(false);
        setReconnectInSec(0);
        return;
      }
      const delay = Math.min(RECON_MAX, RECON_BASE * Math.pow(2, Math.max(0, nextFail - 1)));
      reconnectAtRef.current = Date.now() + delay;
      setReconnecting(hadConnected);
      setReconnectInSec(Math.ceil(delay / 1000));
      reconnectTickRef.current = setInterval(() => {
        const left = Math.max(0, Math.ceil((reconnectAtRef.current - Date.now()) / 1000));
        setReconnectInSec(left);
        if (left <= 0 && reconnectTickRef.current) {
          clearInterval(reconnectTickRef.current);
          reconnectTickRef.current = null;
        }
      }, 500);
      reconnectTimerRef.current = setTimeout(() => {
        if (!mountedRef.current) return;
        conductor.connectWs();
      }, delay);
    },
    [clearReconnectTimers],
  );

  const everRef = useRef(false);
  const failRef = useRef(0);
  const intentionalCloseRef = useRef(false);

  const retryNow = useCallback(() => {
    clearReconnectTimers();
    failRef.current = 0;
    setFailCount(0);
    setReconnecting(false);
    setReconnectInSec(0);
    intentionalCloseRef.current = true;
    conductor.disconnectWs();
    intentionalCloseRef.current = false;
    conductor.connectWs();
  }, [clearReconnectTimers]);

  useEffect(() => {
    mountedRef.current = true;
    everRef.current = false;
    failRef.current = 0;
    intentionalCloseRef.current = false;

    const unsubMsg = conductor.subscribeWs((data) => {
      const type = String(data.type || '');
      if (type === 'hello') {
        setHistoryReady(true);
        const chat = Array.isArray(data.chat) ? data.chat : [];
        setMessages(
          chat.map((raw) => {
            const r = raw as Record<string, unknown>;
            return {
              id: String(r.id ?? ''),
              role: String(r.role || 'system'),
              msg: String(r.msg || ''),
              ts: typeof r.ts === 'number' ? r.ts : undefined,
            };
          }),
        );
        setConductorTyping(!!data.running);
        applyWorkers(data.subagents);
      } else if (type === 'subagents') {
        applyWorkers(data.items);
      } else if (type === 'chat' && data.item && typeof data.item === 'object') {
        const item = data.item as Record<string, unknown>;
        pushMsg({
          id: String(item.id ?? ''),
          role: String(item.role || 'system'),
          msg: String(item.msg || ''),
          ts: typeof item.ts === 'number' ? item.ts : undefined,
        });
      }
    });

    const unsubConn = conductor.subscribeConn((state) => {
      if (!mountedRef.current) return;
      if (state === 'open') {
        clearReconnectTimers();
        everRef.current = true;
        failRef.current = 0;
        setEverConnected(true);
        setServiceAvailable(true);
        setReconnecting(false);
        setFailCount(0);
        setReconnectInSec(0);
        return;
      }
      if (state === 'closed') {
        setServiceAvailable(false);
        if (intentionalCloseRef.current) return;
        if (everRef.current) {
          setReconnecting(true);
          failRef.current = Math.max(1, failRef.current);
          setFailCount(failRef.current);
          scheduleReconnect(failRef.current, true);
        } else {
          failRef.current += 1;
          setFailCount(failRef.current);
          scheduleReconnect(failRef.current, false);
        }
      }
    });

    conductor.connectWs();
    const tickId = setInterval(() => setTick((n) => n + 1), 15000);

    return () => {
      mountedRef.current = false;
      intentionalCloseRef.current = true;
      unsubMsg();
      unsubConn();
      clearReconnectTimers();
      clearInterval(tickId);
      conductor.disconnectWs();
    };
  }, [applyWorkers, pushMsg, clearReconnectTimers, scheduleReconnect]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, conductorTyping]);

  const sendText = useCallback(
    (rawText: string) => {
      const text = rawText.trim();
      if (!text || !conductor.isWsOpen()) return;
      const id = `_local_${++localSeqRef.current}`;
      setMessages((prev) => [
        ...prev,
        { id, _local: true, role: 'user', msg: text, ts: Date.now() },
      ]);
      setConductorTyping(true);
      conductor.sendWs({ msg: text });
    },
    [],
  );

  const abortWorker = useCallback(async (sid: string) => {
    try {
      await conductor.abortSubagent(sid);
    } catch (err) {
      console.error('[collab] abort failed', err);
    }
  }, []);

  const running = workers.filter((w) => w.status === 'running').length;
  const done = workers.filter((w) => w.status === 'reported').length;
  const issue = workers.filter((w) => w.status === 'failed').length;
  const hasChat = historyReady && messages.length > 0;

  const statusLabel = useMemo(() => {
    if (conductorTyping && serviceAvailable) return t('status.running');
    if (serviceAvailable) return t('status.ready');
    if (reconnecting || (!everConnected && failCount < FAIL_MAX)) {
      return t('status.connecting');
    }
    return t('collab.offline');
  }, [conductorTyping, serviceAvailable, reconnecting, everConnected, failCount]);

  const statusKind = serviceAvailable
    ? conductorTyping
      ? 'busy'
      : 'ready'
    : reconnecting || (!everConnected && failCount < FAIL_MAX)
      ? 'connecting'
      : 'offline';

  const showRetry =
    !serviceAvailable && !reconnecting && (everConnected || failCount >= FAIL_MAX);
  const showReconnectBanner = reconnecting && !serviceAvailable;
  const showOfflineBanner =
    !serviceAvailable && !reconnecting && failCount >= FAIL_MAX && !everConnected;

  return (
    <div className={`collab-page${progressOpen ? ' collab-prog-open' : ''}`}>
      <header className="collab-topbar">
        <div className="collab-topbar-left">
          <h1 className="chat-title">{t('page.collab.title')}</h1>
          <span className={`collab-status collab-status--${statusKind}`}>
            <i className="collab-status-dot" aria-hidden />
            {statusLabel}
          </span>
          {showRetry ? (
            <button type="button" className="btn-secondary" onClick={retryNow}>
              {t('collab.retry')}
            </button>
          ) : null}
        </div>
        {hasChat ? (
          <button
            type="button"
            className="btn-secondary"
            title={t('collab.showProgressTitle')}
            onClick={() => setProgressOpen((o) => !o)}
          >
            {progressOpen ? t('collab.hideProgress') : t('collab.progressTitle')}
            {running > 0 ? ` · ${running}` : ''}
            {done > 0 ? ` · ✓${done}` : ''}
            {issue > 0 ? ` · !${issue}` : ''}
          </button>
        ) : null}
      </header>

      {showOfflineBanner || (showRetry && !showReconnectBanner) ? (
        <div className="chat-error" role="alert">
          {t('collab.offline')}
          <button type="button" className="btn-secondary collab-banner-retry" onClick={retryNow}>
            {t('collab.retry')}
          </button>
        </div>
      ) : null}
      {showReconnectBanner && (
        <div className="collab-reconnect" role="status">
          {t('collab.reconnect')}
          {reconnectInSec > 0
            ? ` ${t('collab.reconnectIn', { n: reconnectInSec })}`
            : ''}
        </div>
      )}

      <div className="collab-body">
        <div className="collab-main">
          {!historyReady ? (
            <div className="msg-empty">{t('status.connecting')}</div>
          ) : !hasChat ? (
            <div className="collab-guide">
              <div className="collab-guide-head">
                <div className="collab-guide-title">{t('collab.guideTitle')}</div>
                <p className="collab-guide-when">{t('collab.guideWhen')}</p>
              </div>
              <div className="collab-guide-steps">
                {GUIDE_STEPS.map((step, i) => (
                  <div key={step.t} className="collab-guide-step">
                    <span className="collab-guide-num" aria-hidden>
                      {i + 1}
                    </span>
                    <span className="collab-guide-txt">
                      <span className="collab-guide-label">{t(step.t)}</span>
                      <span className="collab-guide-desc">{t(step.d)}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="msg-list">
              {messages.map((m) => (
                <div key={m.id} className={roleClass(m.role)}>
                  <div className="bubble">{m.msg || '…'}</div>
                </div>
              ))}
              {conductorTyping && serviceAvailable ? (
                <div className="msg msg-system" aria-label={t('collab.typing')}>
                  <div className="bubble">
                    <span className="collab-wait-dots" aria-hidden>
                      <i />
                      <i />
                      <i />
                    </span>
                  </div>
                </div>
              ) : null}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {progressOpen && hasChat ? (
          <aside className="collab-prog-panel" aria-label={t('collab.progressTitle')}>
            <div className="collab-prog-panel-head">
              <span>{t('collab.progressTitle')}</span>
              <button
                type="button"
                className="session-item-del"
                aria-label={t('collab.hideProgress')}
                onClick={() => setProgressOpen(false)}
              >
                ×
              </button>
            </div>
            {(running > 0 || done > 0) && (
              <div className="collab-prog-stats">
                {running > 0 ? (
                  <span className="collab-stat collab-stat--running">
                    <span className="n">{running}</span> {t('collab.statRunning')}
                  </span>
                ) : null}
                {done > 0 ? (
                  <span className="collab-stat collab-stat--done">
                    <span className="n">{done}</span> {t('collab.statDone')}
                  </span>
                ) : null}
              </div>
            )}
            {workers.length === 0 ? (
              <div className="collab-progress-empty">{t('collab.progressEmpty')}</div>
            ) : (
              <div className="collab-workers" data-tick={tick}>
                {workers.map((w) => (
                  <article
                    key={w.id}
                    className={`collab-card collab-card--${w.status}`}
                    onClick={() => setSelectedWorker(w)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      void abortWorker(w.id);
                    }}
                    title={t('collab.abortWorker')}
                  >
                    <div className="collab-card-st">
                      <span className={`collab-st-mark collab-st-mark--${w.status}`} />
                      {t(ST_KEYS[w.status])}
                      {w.updatedAt ? (
                        <span className="collab-card-time">{relTime(w.updatedAt)}</span>
                      ) : null}
                    </div>
                    <div className="collab-card-title">{w.title}</div>
                    <div className="collab-card-sum">{w.summary}</div>
                    {w.status === 'running' ? (
                      <button
                        type="button"
                        className="collab-card-abort"
                        onClick={(e) => {
                          e.stopPropagation();
                          void abortWorker(w.id);
                        }}
                      >
                        {t('collab.abortWorker')}
                      </button>
                    ) : null}
                  </article>
                ))}
              </div>
            )}
          </aside>
        ) : null}
      </div>

      <div className="collab-quick">
        {CHIPS.map((c) => (
          <button
            key={c.key}
            type="button"
            className="collab-chip"
            disabled={!serviceAvailable}
            onClick={() => sendText(t(c.key))}
          >
            {t(c.labelKey)}
          </button>
        ))}
      </div>

      <Composer
        disabled={!serviceAvailable}
        placeholder={t('collab.placeholder')}
        onSend={(text) => sendText(text)}
      />

      {selectedWorker ? (
        <div className="collab-drawer-wrap" role="dialog" aria-modal>
          <button
            type="button"
            className="collab-drawer-backdrop"
            aria-label={t('collab.hideProgress')}
            onClick={() => setSelectedWorker(null)}
          />
          <aside className="collab-drawer">
            <div className="collab-drawer-head">
              <span className="collab-drawer-title">{selectedWorker.title}</span>
              <button
                type="button"
                className="session-item-del"
                onClick={() => setSelectedWorker(null)}
              >
                ×
              </button>
            </div>
            <div className="collab-drawer-body">
              <div className="bubble">
                {selectedWorker.fullReply || t('collab.summaryWait')}
              </div>
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
