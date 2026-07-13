/**
 * Token usage page — mirrors frontends/desktop/static/app.js (~4407–4668).
 * Bridge: GET/POST /token-history, GET /token-stats
 * Conductor tab: conductor.tokenStats() → CONDUCTOR_ORIGIN/token-stats
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as bridge from '../api/bridge';
import * as conductor from '../api/conductor';
import { t } from '../i18n';

type TokTab = 'all' | 'conductor';

type TokRecord = {
  sessionId: string;
  title: string;
  input: number;
  output: number;
  cacheCreate: number;
  cacheRead: number;
  model?: string;
  ts: number;
};

type TokSnap = Record<
  string,
  { input: number; output: number; cacheCreate: number; cacheRead: number }
>;

type CondTotals = {
  input: number;
  output: number;
  cacheCreate: number;
  cacheRead: number;
  cost: number;
};

type SessionMeta = { id: string; title: string; status?: string };

type SessionAgg = {
  sessionId: string;
  title: string;
  deleted: boolean;
  input: number;
  output: number;
  cacheCreate: number;
  cacheRead: number;
  lastTs: number;
  prompts: TokRecord[];
};

const TOK_PER_PAGE = 15;
const COND_ZERO: CondTotals = { input: 0, output: 0, cacheCreate: 0, cacheRead: 0, cost: 0 };

const MODEL_PRICES: Record<string, [number, number]> = {
  'gpt-5.4': [2.5, 15],
  'gpt-5': [1.25, 10],
  'gpt-5-mini': [0.25, 2],
  'gpt-4o': [2.5, 10],
  'gpt-4o-mini': [0.15, 0.6],
  'gpt-4.1': [2, 8],
  'gpt-4.1-mini': [0.4, 1.6],
  'gpt-4.1-nano': [0.1, 0.4],
  'o4-mini': [0.55, 2.2],
  'claude-opus-4-8': [5, 25],
  'claude-opus-4-7': [5, 25],
  'claude-opus-4-6': [5, 25],
  'claude-sonnet-4-6': [3, 15],
  'claude-sonnet-4-5': [3, 15],
  'claude-haiku-4-5': [1, 5],
  'deepseek-v4': [0.14, 0.28],
  'deepseek-v4-pro': [0.435, 0.87],
  'deepseek-chat': [0.14, 0.28],
  'deepseek-reasoner': [0.55, 2.19],
  'glm-5.1': [0.5, 0.5],
  'minimax-m2.7': [0.5, 0.5],
  'kimi-for-coding': [0.5, 2],
};
const CNY_RATE = 7.2;

function estCost(
  inp: number,
  out: number,
  model: string,
  cacheRead: number,
  cacheCreate: number,
): number {
  let p: [number, number] = [3, 15];
  if (model) {
    const m = model.toLowerCase().replace(/\[.*\]/, '');
    p =
      MODEL_PRICES[m] ||
      (Object.entries(MODEL_PRICES).find(([k]) => m.includes(k))?.[1] as [number, number] | undefined) ||
      p;
  }
  const isClaudeOrDS = !!model && /claude|deepseek/i.test(model);
  const cacheReadRate = isClaudeOrDS ? 0.1 : 0.5;
  const cacheWriteRate = isClaudeOrDS ? 1.25 : 1.0;
  return (
    ((inp * p[0] +
      out * p[1] +
      (cacheRead || 0) * p[0] * cacheReadRate +
      (cacheCreate || 0) * p[0] * cacheWriteRate) /
      1e6) *
    CNY_RATE
  );
}

function fmtTok(n: number): string {
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'k';
  return String(n);
}

function fmtTime(ts: number): string {
  return new Date(ts * 1000).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function cacheRate(input: number, cacheRead: number, cacheCreate: number): string {
  const base = input + cacheRead + cacheCreate;
  return base > 0 ? ((cacheRead / base) * 100).toFixed(1) + '%' : '0%';
}

function sumTokens(r: { input?: number; output?: number; cacheRead?: number; cacheCreate?: number }) {
  return (r.input || 0) + (r.output || 0) + (r.cacheRead || 0) + (r.cacheCreate || 0);
}

function parseDateLocal(v: string): number {
  if (!v) return 0;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? 0 : d.getTime() / 1000;
}

function pagerPages(totalPages: number, currentPage: number): number[] {
  const pages = new Set([0, totalPages - 1]);
  for (let i = Math.max(0, currentPage - 2); i <= Math.min(totalPages - 1, currentPage + 2); i++) {
    pages.add(i);
  }
  return [...pages].sort((a, b) => a - b);
}

function sessionFromRaw(raw: Record<string, unknown>): SessionMeta {
  const id = String(raw.sessionId ?? raw.id ?? '');
  return {
    id,
    title: String(raw.title ?? id),
    status: raw.status != null ? String(raw.status) : undefined,
  };
}

function isBusyStatus(status?: string): boolean {
  if (!status) return false;
  const s = status.toLowerCase();
  return s === 'running' || s === 'busy' || s === 'thinking';
}

export function TokenPage() {
  const [tab, setTab] = useState<TokTab>('all');
  const [since, setSince] = useState('');
  const [until, setUntil] = useState('');
  const [page, setPage] = useState(0);
  const [history, setHistory] = useState<TokRecord[]>([]);
  const [snap, setSnap] = useState<TokSnap>({});
  const [condHist, setCondHist] = useState<CondTotals>(COND_ZERO);
  const [condLast, setCondLast] = useState<CondTotals | null>(null);
  const [sessions, setSessions] = useState<SessionMeta[]>([]);
  const [openIds, setOpenIds] = useState<Set<string>>(() => new Set());
  const [condCur, setCondCur] = useState<CondTotals>(COND_ZERO);
  const [condOffline, setCondOffline] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const pollingRef = useRef(false);
  const stateRef = useRef({ history, snap, condHist, condLast, sessions });
  stateRef.current = { history, snap, condHist, condLast, sessions };

  const persist = useCallback(
    async (
      nextHistory: TokRecord[],
      nextSnap: TokSnap,
      nextCondHist: CondTotals,
      nextCondLast: CondTotals | null,
    ) => {
      try {
        await bridge.postTokenHistory({
          history: nextHistory,
          snap: nextSnap,
          conductorHist: nextCondHist,
          conductorLast: nextCondLast,
        });
      } catch {
        /* ignore persist errors */
      }
    },
    [],
  );

  const pollBridge = useCallback(async () => {
    if (pollingRef.current) return;
    pollingRef.current = true;
    try {
      let { history: hist, snap: sn, condHist: ch, condLast: cl, sessions: sess } =
        stateRef.current;

      if (!hist.length) {
        const stored = (await bridge.tokenHistory()) as {
          history?: TokRecord[];
          snap?: TokSnap;
          conductorHist?: CondTotals;
          conductorLast?: CondTotals | null;
        };
        if (stored.history?.length) hist = stored.history;
        if (stored.snap) sn = stored.snap;
        if (stored.conductorHist) ch = { ...COND_ZERO, ...stored.conductorHist };
        if (stored.conductorLast) cl = stored.conductorLast;
      }

      try {
        const sessData = (await bridge.listSessions()) as {
          sessions?: Record<string, unknown>[];
        };
        sess = (sessData.sessions ?? []).map(sessionFromRaw).filter((s) => s.id);
        setSessions(sess);
      } catch {
        /* keep previous sessions */
      }

      const data = (await bridge.tokenStats()) as {
        records?: Array<{
          thread: string;
          input: number;
          output: number;
          cacheCreate: number;
          cacheRead: number;
          model?: string;
        }>;
      };

      const nextHist = [...hist];
      const nextSnap = { ...sn };
      let changed = false;

      for (const r of data.records || []) {
        const key = r.thread;
        const sid = key.replace(/^GA-/, '');
        const sessMeta = sess.find((s) => s.id === sid);
        if (sessMeta && isBusyStatus(sessMeta.status)) continue;

        const prev = nextSnap[key] || { input: 0, output: 0, cacheCreate: 0, cacheRead: 0 };
        let di = r.input - prev.input;
        let do_ = r.output - prev.output;
        let dc = r.cacheCreate - prev.cacheCreate;
        let dr = r.cacheRead - prev.cacheRead;
        if (di < 0 || do_ < 0 || dc < 0 || dr < 0) {
          di = r.input;
          do_ = r.output;
          dc = r.cacheCreate;
          dr = r.cacheRead;
        }
        if (di > 0 || do_ > 0 || dc > 0 || dr > 0) {
          const title = sessMeta?.title || sid;
          nextHist.push({
            sessionId: sid,
            title,
            input: di,
            output: do_,
            cacheCreate: dc,
            cacheRead: dr,
            model: r.model || '',
            ts: Date.now() / 1000,
          });
          if (sessMeta?.title) {
            for (const h of nextHist) {
              if (h.sessionId === sid && (!h.title || h.title === sid)) h.title = sessMeta.title;
            }
          }
          changed = true;
        }
        nextSnap[key] = {
          input: r.input,
          output: r.output,
          cacheCreate: r.cacheCreate,
          cacheRead: r.cacheRead,
        };
      }

      setHistory(nextHist);
      setSnap(nextSnap);
      setCondHist(ch);
      setCondLast(cl);
      setLoadError(null);
      if (changed) {
        await persist(nextHist, nextSnap, ch, cl);
      }
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e));
    } finally {
      pollingRef.current = false;
    }
  }, [persist]);

  const loadConductor = useCallback(async () => {
    let cur: CondTotals = { ...COND_ZERO };
    try {
      const data = (await conductor.tokenStats()) as {
        records?: Array<{
          thread: string;
          input?: number;
          output?: number;
          cacheCreate?: number;
          cacheRead?: number;
          model?: string;
        }>;
      };
      const recs = (data.records || []).filter(
        (r) => r.thread === 'conductor-agent' || r.thread.startsWith('subagent-'),
      );
      for (const r of recs) {
        cur.input += r.input || 0;
        cur.output += r.output || 0;
        cur.cacheCreate += r.cacheCreate || 0;
        cur.cacheRead += r.cacheRead || 0;
        cur.cost += estCost(
          r.input || 0,
          r.output || 0,
          r.model || '',
          r.cacheRead || 0,
          r.cacheCreate || 0,
        );
      }
      setCondOffline(false);
    } catch {
      setCondOffline(true);
      return;
    }

    let hist = { ...stateRef.current.condHist };
    const last = stateRef.current.condLast;
    if (last && (cur.input < last.input || cur.output < last.output)) {
      hist = {
        input: hist.input + last.input,
        output: hist.output + last.output,
        cacheCreate: hist.cacheCreate + last.cacheCreate,
        cacheRead: hist.cacheRead + last.cacheRead,
        cost: hist.cost + last.cost,
      };
    }
    setCondHist(hist);
    setCondLast(cur);
    setCondCur(cur);
    await persist(stateRef.current.history, stateRef.current.snap, hist, cur);
  }, [persist]);

  useEffect(() => {
    if (tab === 'all') void pollBridge();
    else void loadConductor();
  }, [tab, pollBridge, loadConductor]);

  const filtered = useMemo(() => {
    const sinceTs = parseDateLocal(since);
    const untilTs = parseDateLocal(until);
    return history.filter((r) => {
      if (sinceTs && r.ts < sinceTs) return false;
      if (untilTs && r.ts > untilTs) return false;
      return true;
    });
  }, [history, since, until]);

  const stats = useMemo(() => {
    let total = 0;
    let totalInput = 0;
    let totalCacheRead = 0;
    let totalCacheCreate = 0;
    for (const r of filtered) {
      total += sumTokens(r);
      totalInput += r.input || 0;
      totalCacheRead += r.cacheRead || 0;
      totalCacheCreate += r.cacheCreate || 0;
    }
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayTs = todayStart.getTime() / 1000;
    let todayT = 0;
    for (const r of history) {
      if (r.ts >= todayTs) todayT += sumTokens(r);
    }
    return {
      total: fmtTok(total),
      cache: cacheRate(totalInput, totalCacheRead, totalCacheCreate),
      today: fmtTok(todayT),
    };
  }, [filtered, history]);

  const sessionRows = useMemo(() => {
    const bySession = new Map<string, SessionAgg>();
    for (const r of filtered) {
      const k = r.sessionId || '?';
      const ss = sessions.find((s) => s.id === k);
      const title = ss ? ss.title : r.title || k;
      const deleted = !ss;
      if (!bySession.has(k)) {
        bySession.set(k, {
          sessionId: k,
          title,
          deleted,
          input: 0,
          output: 0,
          cacheCreate: 0,
          cacheRead: 0,
          lastTs: 0,
          prompts: [],
        });
      }
      const s = bySession.get(k)!;
      s.input += r.input || 0;
      s.output += r.output || 0;
      s.cacheCreate += r.cacheCreate || 0;
      s.cacheRead += r.cacheRead || 0;
      if (r.ts > s.lastTs) {
        s.lastTs = r.ts;
        s.title = title;
        s.deleted = deleted;
      }
      s.prompts.push(r);
    }
    return [...bySession.values()].sort((a, b) => b.lastTs - a.lastTs);
  }, [filtered, sessions]);

  const totalPages = Math.max(1, Math.ceil(sessionRows.length / TOK_PER_PAGE));
  const safePage = Math.min(page, totalPages - 1);
  const pageItems = sessionRows.slice(safePage * TOK_PER_PAGE, (safePage + 1) * TOK_PER_PAGE);

  const condTotal = useMemo(
    () => ({
      input: condHist.input + condCur.input,
      output: condHist.output + condCur.output,
      cacheCreate: condHist.cacheCreate + condCur.cacheCreate,
      cacheRead: condHist.cacheRead + condCur.cacheRead,
    }),
    [condHist, condCur],
  );

  const resetFilters = () => {
    setSince('');
    setUntil('');
    setPage(0);
  };

  const toggleOpen = (id: string) => {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="tok-page">
      <header className="tok-topbar">
        <div>
          <h1 className="chat-title">{t('page.token.title')}</h1>
          <p className="tok-sub">{t('page.token.sub')}</p>
        </div>
      </header>

      {loadError && tab === 'all' ? (
        <div className="chat-error" role="alert">
          {t('err.bridge')}
          {loadError ? ` · ${loadError}` : ''}
        </div>
      ) : null}

      <div className="tok-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'all'}
          className={`tok-tab${tab === 'all' ? ' active' : ''}`}
          onClick={() => {
            setTab('all');
            setPage(0);
          }}
        >
          {t('tok.tabAll')}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'conductor'}
          className={`tok-tab${tab === 'conductor' ? ' active' : ''}`}
          onClick={() => {
            setTab('conductor');
            setPage(0);
          }}
        >
          {t('tok.tabConductor')}
        </button>
      </div>

      {tab === 'all' ? (
        <>
          <div className="tok-filter">
            <label htmlFor="tok-since">{t('tok.from')}</label>
            <input
              id="tok-since"
              type="datetime-local"
              className="tok-date"
              value={since}
              onChange={(e) => {
                setSince(e.target.value);
                setPage(0);
              }}
            />
            <label htmlFor="tok-until">{t('tok.to')}</label>
            <input
              id="tok-until"
              type="datetime-local"
              className="tok-date"
              value={until}
              onChange={(e) => {
                setUntil(e.target.value);
                setPage(0);
              }}
            />
            <button type="button" className="tok-reset" onClick={resetFilters}>
              {t('tok.reset')}
            </button>
          </div>

          <div className="stat-row">
            <div className="stat">
              <div className="s-n">{stats.total}</div>
              <div className="s-l">{t('tok.total')}</div>
            </div>
            <div className="stat">
              <div className="s-n">{stats.cache}</div>
              <div className="s-l">{t('tok.cost')}</div>
            </div>
            <div className="stat">
              <div className="s-n">{stats.today}</div>
              <div className="s-l">{t('tok.today')}</div>
            </div>
          </div>
        </>
      ) : null}

      <table className={`tok-table${tab === 'conductor' ? ' tok-table--conductor' : ''}`}>
        <thead>
          <tr>
            <th>{t('tok.colSession')}</th>
            <th>{t('tok.colIn')}</th>
            <th>{t('tok.colOut')}</th>
            <th>{t('tok.colCacheW')}</th>
            <th>{t('tok.colCache')}</th>
            <th>{t('tok.cost')}</th>
          </tr>
        </thead>
        <tbody>
          {tab === 'conductor' ? (
            condOffline ? (
              <tr>
                <td colSpan={6} className="tok-empty">
                  {t('tok.condOffline')}
                </td>
              </tr>
            ) : (
              <>
                <tr className="tok-row-conductor" title={t('tok.condTip')}>
                  <td>{t('tok.condTotal')}</td>
                  <td>{fmtTok(condTotal.input)}</td>
                  <td>{fmtTok(condTotal.output)}</td>
                  <td>{fmtTok(condTotal.cacheCreate)}</td>
                  <td>{fmtTok(condTotal.cacheRead)}</td>
                  <td>
                    {cacheRate(condTotal.input, condTotal.cacheRead, condTotal.cacheCreate)}
                  </td>
                </tr>
                <tr className="tok-row-conductor" title={t('tok.condTip')}>
                  <td>{t('tok.condCurrent')}</td>
                  <td>{fmtTok(condCur.input)}</td>
                  <td>{fmtTok(condCur.output)}</td>
                  <td>{fmtTok(condCur.cacheCreate)}</td>
                  <td>{fmtTok(condCur.cacheRead)}</td>
                  <td>{cacheRate(condCur.input, condCur.cacheRead, condCur.cacheCreate)}</td>
                </tr>
              </>
            )
          ) : pageItems.length === 0 ? (
            <tr>
              <td colSpan={6} className="tok-empty">
                {t('tok.noData')}
              </td>
            </tr>
          ) : (
            pageItems.map((s) => {
              const open = openIds.has(s.sessionId);
              const prompts = [...s.prompts].sort((a, b) => b.ts - a.ts);
              return (
                <TokSessionBlock
                  key={s.sessionId}
                  session={s}
                  open={open}
                  prompts={prompts}
                  onToggle={() => toggleOpen(s.sessionId)}
                />
              );
            })
          )}
        </tbody>
      </table>

      {tab === 'all' && sessionRows.length > TOK_PER_PAGE ? (
        <div className="tok-pager">
          <button
            type="button"
            className="tok-pager-arrow"
            disabled={safePage === 0}
            onClick={() => setPage(safePage - 1)}
            aria-label="prev"
          >
            ‹
          </button>
          {pagerPages(totalPages, safePage).map((p, i, arr) => {
            const prev = i > 0 ? arr[i - 1] : -1;
            const gap = prev >= 0 && p - prev > 1;
            return (
              <span key={p} className="tok-pager-chunk">
                {gap ? <span className="tok-pager-gap">…</span> : null}
                <button
                  type="button"
                  className={p === safePage ? 'active' : ''}
                  onClick={() => setPage(p)}
                >
                  {p + 1}
                </button>
              </span>
            );
          })}
          <button
            type="button"
            className="tok-pager-arrow"
            disabled={safePage >= totalPages - 1}
            onClick={() => setPage(safePage + 1)}
            aria-label="next"
          >
            ›
          </button>
        </div>
      ) : null}

      <p className="tok-disclaimer">{t('tok.disclaimer')}</p>
    </div>
  );
}

function TokSessionBlock({
  session: s,
  open,
  prompts,
  onToggle,
}: {
  session: SessionAgg;
  open: boolean;
  prompts: TokRecord[];
  onToggle: () => void;
}) {
  return (
    <>
      <tr className={`tok-row-session${open ? ' open' : ''}`} onClick={onToggle}>
        <td title={s.title}>
          {s.title}
          {s.deleted ? <span className="tok-deleted">{t('tok.deleted')}</span> : null}
        </td>
        <td>{fmtTok(s.input)}</td>
        <td>{fmtTok(s.output)}</td>
        <td>{fmtTok(s.cacheCreate)}</td>
        <td>{fmtTok(s.cacheRead)}</td>
        <td>{cacheRate(s.input, s.cacheRead, s.cacheCreate)}</td>
      </tr>
      {open
        ? prompts.map((p, i) => (
            <tr key={`${s.sessionId}-${p.ts}-${i}`} className="tok-detail">
              <td>
                {fmtTime(p.ts)}
                {p.model ? (
                  <>
                    {' · '}
                    <span className="tok-model-tip">{p.model}</span>
                  </>
                ) : null}
              </td>
              <td>{fmtTok(p.input || 0)}</td>
              <td>{fmtTok(p.output || 0)}</td>
              <td>{fmtTok(p.cacheCreate || 0)}</td>
              <td>{fmtTok(p.cacheRead || 0)}</td>
              <td>{cacheRate(p.input || 0, p.cacheRead || 0, p.cacheCreate || 0)}</td>
            </tr>
          ))
        : null}
    </>
  );
}
