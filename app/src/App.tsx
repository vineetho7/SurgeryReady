import { useMedplumProfile } from '@medplum/react';
import { useState, type JSX } from 'react';
import { NavLink, Outlet } from 'react-router';
import { invalidateBoard, useBoard } from './lib/fhir';
import { connect, getAuthError } from './lib/session';

function Logo(): JSX.Element {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="10" cy="10" r="8.4" fill="none" stroke="var(--series-1)" strokeWidth="1.8" />
      <path d="M6 10.4l2.7 2.7L14.2 7" fill="none" stroke="var(--series-1)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
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
        <Logo />
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
          <Logo />
          SurgeryReady
        </div>

        <nav className="nav">
          <div className="nav-label">Perioperative</div>
          <NavLink to="/" end className={({ isActive }) => (isActive ? 'active' : '')}>
            <span>Today's board</span>
          </NavLink>
          <NavLink to="/preop" className={({ isActive }) => (isActive ? 'active' : '')}>
            <span>Pre-op readiness</span>
            {preopFlagged !== undefined && <span className="count">{preopFlagged}</span>}
          </NavLink>
          <NavLink to="/recovery" className={({ isActive }) => (isActive ? 'active' : '')}>
            <span>Recovery</span>
            {recoveryFlagged !== undefined && <span className="count">{recoveryFlagged}</span>}
          </NavLink>
        </nav>

        <div className="sidebar-foot">
          {profile ? 'Connected to Medplum' : 'Connecting…'}
          <br />
          <span style={{ color: 'var(--text-secondary)' }}>Demo project</span>
        </div>
      </aside>

      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
