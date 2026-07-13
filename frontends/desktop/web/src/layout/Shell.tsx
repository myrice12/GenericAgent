import type { ReactNode } from 'react';
import { t } from '../i18n';

export type Page = 'chat' | 'collab' | 'services' | 'token';

type ShellProps = {
  page: Page;
  onNavigate: (p: Page) => void;
  children: ReactNode;
  rail?: ReactNode;
};

const NAV_ITEMS: { id: Page; labelKey: 'nav.chat' | 'nav.collab' | 'nav.services' | 'nav.token' }[] = [
  { id: 'chat', labelKey: 'nav.chat' },
  { id: 'collab', labelKey: 'nav.collab' },
  { id: 'services', labelKey: 'nav.services' },
  { id: 'token', labelKey: 'nav.token' },
];

export function Shell({ page, onNavigate, children, rail }: ShellProps) {
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-name">{t('brand.name')}</div>
          <div className="brand-sub">{t('brand.sub')}</div>
        </div>
        <nav className="nav">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`nav-item${page === item.id ? ' active' : ''}`}
              onClick={() => onNavigate(item.id)}
            >
              {t(item.labelKey)}
            </button>
          ))}
        </nav>
      </aside>
      <main className="main">{children}</main>
      {rail != null ? <aside className="rail">{rail}</aside> : null}
    </div>
  );
}
