import { t } from '../i18n';

export type SessionItem = {
  id: string;
  title: string;
  status?: string;
};

type SessionRailProps = {
  sessions: SessionItem[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete?: (id: string) => void;
};

export function SessionRail({
  sessions,
  activeId,
  onSelect,
  onNew,
  onDelete,
}: SessionRailProps) {
  return (
    <div className="session-rail">
      <div className="session-rail-head">
        <h2 className="session-rail-title">{t('chat.sessions')}</h2>
        <button type="button" className="btn-secondary" onClick={onNew}>
          {t('chat.newSession')}
        </button>
      </div>
      <ul className="session-list">
        {sessions.map((s) => (
          <li key={s.id}>
            <button
              type="button"
              className={`session-item${s.id === activeId ? ' active' : ''}`}
              onClick={() => onSelect(s.id)}
            >
              <span className="session-item-title">{s.title || s.id}</span>
              {s.status ? (
                <span className="session-item-status">{s.status}</span>
              ) : null}
            </button>
            {onDelete ? (
              <button
                type="button"
                className="session-item-del"
                title={t('chat.deleteSession')}
                aria-label={t('chat.deleteSession')}
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(s.id);
                }}
              >
                ×
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
