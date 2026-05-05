import { Link, useLocation } from 'react-router';

type NavMode = 'mobile' | 'desktop';

const NAV_ITEMS = [
  {
    to: '/',
    label: 'Dashboard',
    icon: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </>
    ),
  },
  {
    to: '/schedule',
    label: 'Schedule',
    icon: (
      <>
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <path d="M3 9h18" />
        <path d="M8 2v4M16 2v4" />
      </>
    ),
  },
  {
    to: '/tasks',
    label: 'Tasks',
    icon: (
      <>
        <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
        <rect x="9" y="3" width="6" height="4" rx="1" />
        <path d="M9 12l2 2 4-4" />
      </>
    ),
  },
  {
    to: '/settings',
    label: 'Settings',
    icon: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </>
    ),
  },
];

export function DesktopSidebar() {
  const location = useLocation();

  return (
    <aside className="hidden lg:flex lg:w-[248px] lg:flex-col lg:gap-8 lg:rounded-[24px] lg:border lg:border-[var(--border)] lg:bg-[rgba(255,255,255,0.04)] lg:p-6 lg:backdrop-blur-xl lg:shadow-[0_24px_48px_rgba(0,0,0,0.22)]">
      <div>
        <p className="text-[11px] uppercase tracking-[0.24em] text-[var(--muted)]">Workspace</p>
        <h2 className="mt-3 text-[28px] font-[700] leading-none text-[var(--text)]">DayFlow</h2>
        <p className="mt-3 text-[13px] leading-6 text-[var(--muted2)]">
          Calm planning for focused days and gentle routines.
        </p>
      </div>

      <nav className="space-y-2">
        {NAV_ITEMS.map((item) => {
          const active = item.to === '/' ? location.pathname === '/' : location.pathname.startsWith(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`dayflow-nav-link ${active ? 'is-active' : ''}`}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="w-5 h-5">
                {item.icon}
              </svg>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto rounded-[20px] border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-4">
        <p className="text-[11px] uppercase tracking-[0.22em] text-[var(--muted)]">Theme</p>
        <p className="mt-2 text-[14px] font-[600] text-[var(--text)]">Soft dark mode</p>
        <p className="mt-2 text-[13px] leading-6 text-[var(--muted2)]">
          Accent-led highlights, minimal noise, and a steady workspace for deep planning.
        </p>
      </div>
    </aside>
  );
}

export default function AppNav({ mode }: { mode: NavMode }) {
  const location = useLocation();

  if (mode === 'desktop') {
    return <DesktopSidebar />;
  }

  return (
    <nav className="dayflow-bottom-nav lg:hidden">
      {NAV_ITEMS.map((item) => {
        const active = item.to === '/' ? location.pathname === '/' : location.pathname.startsWith(item.to);
        return (
          <Link key={item.to} to={item.to} className={`dayflow-bottom-nav-link ${active ? 'is-active' : ''}`}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="w-5 h-5">
              {item.icon}
            </svg>
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
