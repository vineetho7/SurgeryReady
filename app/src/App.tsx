import { useMedplumProfile } from '@medplum/react';
import { useCallback, useEffect, useState, type JSX } from 'react';
import { NavLink, Outlet } from 'react-router';
import { IconBoard, IconClipboard, IconMoon, IconPulse, IconSun } from './components/icons';
import { VoiceDock } from './components/VoiceDock';
import { invalidateBoard, useBoard } from './lib/fhir';
import { connect, getAuthError } from './lib/session';

function BrandMark(): JSX.Element {
  return (
    <span className="brand-mark" aria-hidden="true">
      <svg width="18" height="18" viewBox="0 0 20 20">
        <path d="M6 10.4l2.7 2.7L14.2 7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

type Theme = 'light' | 'dark';

function currentTheme(): Theme {
  if (typeof document === 'undefined') {
    return 'light';
  }
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

/** Light/dark switch. Persists the clinician's choice; the pre-paint script in index.html restores it. */
function ThemeToggle(): JSX.Element {
  const [theme, setTheme] = useState<Theme>(currentTheme);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem('sr-theme', theme);
    } catch {
      /* private mode — the in-memory state still holds for the session */
    }
  }, [theme]);

  const toggle = useCallback(() => setTheme((t) => (t === 'dark' ? 'light' : 'dark')), []);
  const next = theme === 'dark' ? 'light' : 'dark';

  return (
    <button type="button" className="theme-toggle" onClick={toggle} aria-label={`Switch to ${next} mode`}>
      {theme === 'dark' ? <IconSun size={16} /> : <IconMoon size={16} />}
      {theme === 'dark' ? 'Light mode' : 'Dark mode'}
    </button>
  );
}

/**
 * Shown when the app could not authenticate. Without this, a failed login looked exactly
 * like an empty database: every page said "not found" and nothing said why.
 */
function NotConnected(): JSX.Element {
  const [retrying, setRetrying] = useState(false);
  const [error, setError] = useState(getAuthError());

  async function retry(): Promise<void> {
    setRetrying(true);
    const ok = await connect();
    setError(getAuthError());
    setRetrying(false);
    if (ok) {
      invalidateBoard();
      window.location.reload();
    }
  }

  return (
    <div className="signin-wrap">
      <div className="signin-brand">
        <BrandMark />
        SurgeryReady
      </div>
      <div className="card" style={{ maxWidth: 460 }}>
        <div className="card-head">
          <h2>Not connected to Medplum</h2>
        </div>
        <div className="card-body">
          <p style={{ marginTop: 0, color: 'var(--text-secondary)' }}>
            The dashboard signs itself in with the project's ClientApplication. That did not succeed, so there is no
            data to show.
          </p>
          {error && (
            <div className="hint-box" style={{ marginBottom: 14 }}>
              {error}
            </div>
          )}
          <button type="button" className="mic" onClick={retry} disabled={retrying}>
            {retrying ? 'Retrying…' : 'Retry connection'}
          </button>
          <div className="hint-box">
            Check that <code>MEDPLUM_CLIENT_ID</code> and <code>MEDPLUM_CLIENT_SECRET</code> are set in{' '}
            <code>app/.env</code>, and that the dev server was restarted after editing it — Vite reads env files only at
            startup.
          </div>
        </div>
      </div>
    </div>
  );
}

export function App(): JSX.Element {
  const profile = useMedplumProfile();
  const { board } = useBoard();

  if (!profile) {
    return <NotConnected />;
  }

  const preopFlagged = board?.preop.filter(
    (c) => c.readiness === 'needs-attention' || c.readiness === 'clinical-review'
  ).length;
  const recoveryFlagged = board?.recovery.filter((c) => c.state === 'off-track' || c.state === 'watch').length;

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <BrandMark />
          SurgeryReady
        </div>

        <nav className="nav">
          <div className="nav-label">Perioperative</div>
          <NavLink to="/" end className={({ isActive }) => (isActive ? 'active' : '')}>
            <IconBoard size={18} />
            <span className="nav-text">Today's board</span>
          </NavLink>
          <NavLink to="/preop" className={({ isActive }) => (isActive ? 'active' : '')}>
            <IconClipboard size={18} />
            <span className="nav-text">Pre-op readiness</span>
            {preopFlagged !== undefined && (
              <span className="count" data-alert={preopFlagged > 0}>
                {preopFlagged}
              </span>
            )}
          </NavLink>
          <NavLink to="/recovery" className={({ isActive }) => (isActive ? 'active' : '')}>
            <IconPulse size={18} />
            <span className="nav-text">Recovery</span>
            {recoveryFlagged !== undefined && (
              <span className="count" data-alert={recoveryFlagged > 0}>
                {recoveryFlagged}
              </span>
            )}
          </NavLink>
        </nav>

        <div className="sidebar-foot">
          <ThemeToggle />
          <span className="conn">
            <span className={`dot ${profile ? '' : 'off'}`} />
            {profile ? 'Connected to Medplum' : 'Connecting…'}
          </span>
        </div>
      </aside>

      <main className="main">
        <Outlet />
      </main>

      <VoiceDock />
    </div>
  );
}
