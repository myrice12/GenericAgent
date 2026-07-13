/**
 * Services page — sources from frontends/desktop/static/app.js
 * (svc tabs ~4967–5498) + bridge.ts servicesPanel / serviceStart / serviceStop.
 *
 * - GET /services/panel → list
 * - POST /services/start|stop { id }
 * - WS services.snapshot / service.changed via bridgeWs (HTTP fallback if WS down)
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as bridge from '../api/bridge';
import * as bridgeWs from '../api/bridgeWs';
import { t, type ZhKey } from '../i18n';

type SvcTab = 'channels' | 'status';

type ServiceItem = {
  id: string;
  name?: string;
  status?: string;
  running?: boolean;
  pid?: number | null;
  memMb?: number | null;
  cpuPct?: number | null;
  managed?: boolean;
  lastError?: string;
  bridgeOffline?: boolean;
};

const BRIDGE_SERVICE_ID = '__bridge__';
const EXTRA_SERVICE_IDS = new Set(['frontends/conductor.py', 'reflect/scheduler.py']);

const CHAN_FILE_LABELS: Record<string, ZhKey> = {
  'qqapp.py': 'ch.qq',
  'wechatapp.py': 'ch.wechat',
  'wecomapp.py': 'ch.wecom',
  'dingtalkapp.py': 'ch.dingtalk',
  'tgapp.py': 'ch.telegram',
  'dcapp.py': 'ch.discord',
  'fsapp.py': 'ch.lark',
};

const STATUS_LABEL: Record<string, ZhKey> = {
  running: 'st.running',
  offline: 'st.offline',
  error: 'st.error',
  starting: 'st.starting',
  stopping: 'st.stopping',
};

function channelDisplayName(ch: ServiceItem): string {
  const file = (ch.name || ch.id || '').split('/').pop() || '';
  const key = CHAN_FILE_LABELS[file];
  return key ? t(key) : ch.name || ch.id || '';
}

function statusDisplayName(s: ServiceItem): string {
  if (s.id === BRIDGE_SERVICE_ID) return s.name || 'bridge';
  if (s.id === 'reflect/scheduler.py') return t('proc.scheduler');
  if (s.id === 'frontends/conductor.py') return t('proc.conductor');
  return channelDisplayName(s);
}

function statusClass(status: string | undefined): 'on' | 'off' | 'err' {
  if (status === 'running') return 'on';
  if (status === 'error') return 'err';
  return 'off';
}

function statusLabel(status: string | undefined): string {
  const key = STATUS_LABEL[status || 'offline'] || 'st.offline';
  return t(key);
}

function fmtPid(pid: number | null | undefined): string {
  return pid ? `PID ${pid}` : '—';
}

function fmtRes(s: ServiceItem): string {
  const cpu = s.cpuPct != null ? `${s.cpuPct}%` : '—';
  const mem = s.memMb != null ? `${s.memMb}MB` : '—';
  return `${cpu} / ${mem}`;
}

function bridgeOfflinePanelServices(): ServiceItem[] {
  return [
    {
      id: BRIDGE_SERVICE_ID,
      name: 'bridge',
      status: 'offline',
      running: false,
      pid: null,
      memMb: null,
      cpuPct: null,
      managed: false,
    },
    {
      id: 'frontends/conductor.py',
      name: 'frontends/conductor.py',
      status: 'offline',
      running: false,
      pid: null,
      memMb: null,
      cpuPct: null,
      managed: false,
      bridgeOffline: true,
    },
    {
      id: 'reflect/scheduler.py',
      name: 'reflect/scheduler.py',
      status: 'offline',
      running: false,
      pid: null,
      memMb: null,
      cpuPct: null,
      managed: false,
      bridgeOffline: true,
    },
  ];
}

function applyChanged(prev: ServiceItem[], service: ServiceItem): ServiceItem[] {
  if (!service?.id) return prev;
  const idx = prev.findIndex((s) => s.id === service.id);
  if (idx < 0) return [...prev, service];
  const next = prev.slice();
  next[idx] = { ...next[idx], ...service };
  return next;
}

export function ServicesPage() {
  const [tab, setTab] = useState<SvcTab>('channels');
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [bridgeOffline, setBridgeOffline] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ title: string; detail?: string; kind: 'ok' | 'err' } | null>(
    null,
  );
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((title: string, detail: string, kind: 'ok' | 'err') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ title, detail: detail || undefined, kind });
    toastTimerRef.current = setTimeout(() => setToast(null), 3000);
  }, []);

  const loadPanel = useCallback(async () => {
    try {
      const res = (await bridge.servicesPanel()) as { services?: ServiceItem[] };
      setServices(res.services || []);
      setBridgeOffline(false);
      setLoadError(null);
    } catch (e) {
      setBridgeOffline(true);
      setServices(bridgeOfflinePanelServices());
      setLoadError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void loadPanel();

    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    const scheduleRefresh = () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => {
        void loadPanel();
      }, 120);
    };

    bridgeWs.connect();
    const unsub = bridgeWs.subscribe((msg) => {
      // WS snapshot is IM-only (list_state); panel has bridge + extras + metrics.
      // Prefer re-fetching /services/panel; applyChanged keeps UI snappy meantime.
      if (msg.type === 'services.snapshot' && Array.isArray(msg.services)) {
        setServices((prev) => {
          let next = prev;
          for (const s of msg.services as ServiceItem[]) {
            next = applyChanged(next, s);
          }
          return next;
        });
        setBridgeOffline(false);
        scheduleRefresh();
      } else if (msg.type === 'service.changed' && msg.service && typeof msg.service === 'object') {
        setServices((prev) => applyChanged(prev, msg.service as ServiceItem));
        setBridgeOffline(false);
        scheduleRefresh();
      } else if (msg.type === 'bridge-ready') {
        scheduleRefresh();
      }
      /* bridge-closed / errors: keep last HTTP snapshot (graceful degrade) */
    });

    return () => {
      unsub();
      if (refreshTimer) clearTimeout(refreshTimer);
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, [loadPanel]);

  const channels = useMemo(
    () => services.filter((ch) => (ch.id || '').startsWith('frontends/')),
    [services],
  );

  const statusList = useMemo(() => {
    if (bridgeOffline) return bridgeOfflinePanelServices();
    return services;
  }, [bridgeOffline, services]);

  const toggleService = useCallback(
    async (id: string, running: boolean) => {
      if (busyId || id === BRIDGE_SERVICE_ID) return;
      setBusyId(id);
      const label =
        tab === 'channels'
          ? channelDisplayName(services.find((s) => s.id === id) || { id })
          : statusDisplayName(services.find((s) => s.id === id) || { id });
      try {
        if (running) {
          const res = (await bridge.serviceStop(id)) as { service?: ServiceItem };
          if (res.service) setServices((prev) => applyChanged(prev, res.service!));
          showToast(`${t('sys.channelStopped')} · ${label}`, '', 'ok');
        } else {
          const res = (await bridge.serviceStart(id)) as {
            service?: ServiceItem;
            ok?: boolean;
            error?: string;
          };
          if (res.service) {
            setServices((prev) => applyChanged(prev, res.service!));
            if (res.service.status === 'error') {
              throw Object.assign(new Error(res.service.lastError || 'start_failed'), {
                data: res,
              });
            }
          }
          showToast(`${t('sys.channelStarted')} · ${label}`, '', 'ok');
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        const detail =
          msg === 'not_configured' ? t('err.channelNotConfigured') : msg;
        showToast(
          `${running ? t('err.channelStop') : t('err.channelStart')} · ${label}`,
          detail,
          'err',
        );
        void loadPanel();
      } finally {
        setBusyId(null);
      }
    },
    [busyId, loadPanel, services, showToast, tab],
  );

  return (
    <div className="svc-page">
      <header className="svc-topbar">
        <div>
          <h1 className="chat-title">{t('page.services.title')}</h1>
          <p className="svc-sub">{t('page.services.sub')}</p>
        </div>
        {bridgeOffline ? (
          <button type="button" className="btn-secondary" onClick={() => void loadPanel()}>
            {t('svc.retry')}
          </button>
        ) : null}
      </header>

      {bridgeOffline && loadError ? (
        <div className="chat-error" role="alert">
          {t('err.bridge')}
          {loadError ? ` · ${loadError}` : ''}
        </div>
      ) : null}

      <div className="svc-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'channels'}
          className={`svc-tab${tab === 'channels' ? ' active' : ''}`}
          onClick={() => setTab('channels')}
        >
          {t('page.channels.title')}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'status'}
          className={`svc-tab${tab === 'status' ? ' active' : ''}`}
          onClick={() => setTab('status')}
        >
          {t('page.status.title')}
        </button>
      </div>

      {tab === 'channels' ? (
        <div className="svc-panel active" role="tabpanel">
          <p className="svc-panel-sub">{t('page.channels.sub')}</p>
          {channels.length === 0 ? (
            <div className="list-empty">{t('ch.empty')}</div>
          ) : (
            <div className="svc-list">
              {channels.map((ch) => {
                const running = !!ch.running;
                const st = statusClass(ch.status || 'offline');
                return (
                  <div key={ch.id} className="list-row" data-channel-id={ch.id}>
                    <div className="chan-meta">
                      <b className="chan-name">{channelDisplayName(ch)}</b>
                      <span className="kv chan-path">{ch.name || ch.id}</span>
                    </div>
                    <span className={`lr-st ${st}`}>{statusLabel(ch.status || 'offline')}</span>
                    <span className="grow" />
                    <button
                      type="button"
                      className={`sw-mini${running ? ' on' : ''}`}
                      aria-pressed={running}
                      aria-label={running ? t('act.stop') : t('act.start')}
                      disabled={busyId === ch.id || bridgeOffline}
                      onClick={() => void toggleService(ch.id, running)}
                    >
                      <i />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="svc-panel active" role="tabpanel">
          <p className="svc-panel-sub">{t('page.status.sub')}</p>
          <div className="svc-list">
            {statusList.map((s) => {
              const running = !!s.running;
              const st = statusClass(s.status || 'offline');
              const managed = s.managed !== false;
              const isBridge = s.id === BRIDGE_SERVICE_ID;
              const isExtra = EXTRA_SERVICE_IDS.has(s.id);
              const canToggle = !isBridge && !s.bridgeOffline && managed && !bridgeOffline;
              return (
                <div key={s.id} className="list-row" data-service-id={s.id}>
                  <b className="st-name">{statusDisplayName(s)}</b>
                  <span className={`lr-st ${st}`}>{statusLabel(s.status || 'offline')}</span>
                  <span className="kv st-pid">{fmtPid(s.pid)}</span>
                  <span className="kv st-res">{fmtRes(s)}</span>
                  <span className="grow" />
                  {canToggle ? (
                    isExtra ? (
                      <button
                        type="button"
                        className={`link-btn link sm${running ? ' on' : ''}`}
                        disabled={busyId === s.id}
                        onClick={() => void toggleService(s.id, running)}
                      >
                        {running ? t('act.exit') : t('act.start')}
                      </button>
                    ) : (
                      <button
                        type="button"
                        className={`sw-mini${running ? ' on' : ''}`}
                        aria-pressed={running}
                        disabled={busyId === s.id}
                        onClick={() => void toggleService(s.id, running)}
                      >
                        <i />
                      </button>
                    )
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {toast ? (
        <div className="toast-root" aria-live="polite">
          <div className={`toast toast-${toast.kind} show`}>
            <span className="toast-title">{toast.title}</span>
            {toast.detail ? <span className="toast-detail">{toast.detail}</span> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
