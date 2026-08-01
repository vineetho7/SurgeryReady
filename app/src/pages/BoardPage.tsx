import type { JSX } from 'react';
import { useNavigate } from 'react-router';
import { IconAlert, IconCalendar, IconPulse, IconShieldCheck } from '../components/icons';
import { StatusPill } from '../components/StatusPill';
import { useBoard, type PreopCase, type RecoveryCase } from '../lib/fhir';
import { READINESS_LABEL, READINESS_TONE, RECOVERY_LABEL, RECOVERY_TONE } from '../lib/model';

function Chevron(): JSX.Element {
  return (
    <svg className="chev" width="15" height="15" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M6 3.5L10.5 8 6 12.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function timeOf(iso?: string): string {
  return iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';
}

/** First letter of the first two name parts — a stable, quiet identifier for the row. */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '·';
}

function PreopRow({ item, onOpen }: { item: PreopCase; onOpen: () => void }): JSX.Element {
  const flag =
    item.readiness === 'clinical-review' ? 'flagged' : item.readiness === 'needs-attention' ? 'flagged-warn' : '';
  return (
    <div className={`row ${flag}`} onClick={onOpen} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onOpen()}>
      <span className="when">{timeOf(item.start)}</span>
      <span className="avatar" aria-hidden="true">{initials(item.name)}</span>
      <span className="who">
        <span className="name">{item.name}</span>
        <span className="proc">{item.procedure}</span>
      </span>
      <StatusPill tone={READINESS_TONE[item.readiness]} label={READINESS_LABEL[item.readiness]} />
      <Chevron />
    </div>
  );
}

function RecoveryRow({ item, onOpen }: { item: RecoveryCase; onOpen: () => void }): JSX.Element {
  const flag = item.state === 'off-track' ? 'flagged' : item.state === 'watch' ? 'flagged-warn' : '';
  return (
    <div className={`row ${flag}`} onClick={onOpen} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onOpen()}>
      <span className="when">POD {item.postOpDay}</span>
      <span className="avatar" aria-hidden="true">{initials(item.name)}</span>
      <span className="who">
        <span className="name">{item.name}</span>
        <span className="proc">{item.procedure}</span>
      </span>
      <StatusPill tone={RECOVERY_TONE[item.state]} label={RECOVERY_LABEL[item.state]} />
      <Chevron />
    </div>
  );
}

export function BoardPage({ view = 'all' }: { view?: 'all' | 'preop' | 'recovery' }): JSX.Element {
  const { board, loading, error } = useBoard();
  const navigate = useNavigate();

  if (loading) {
    return <div className="muted-block">Loading the board…</div>;
  }
  if (error) {
    return <div className="muted-block">Could not load: {error.message}</div>;
  }
  if (!board) {
    return <div className="muted-block">No data.</div>;
  }

  const preopFlagged = board.preop.filter((c) => c.readiness !== 'ready' && c.readiness !== 'unknown');
  const recoveryFlagged = board.recovery.filter((c) => c.state === 'off-track' || c.state === 'watch');
  const notCalled = board.preop.filter((c) => c.readiness === 'unknown');

  const showPreop = view === 'all' || view === 'preop';
  const showRecovery = view === 'all' || view === 'recovery';

  return (
    <div className="fade-in">
      <div className="page-head">
        <div>
          <h1>{view === 'preop' ? 'Pre-op readiness' : view === 'recovery' ? 'Recovery monitoring' : "Today's board"}</h1>
          <p className="subtitle">
            {view === 'recovery'
              ? 'Patients being monitored at home after surgery.'
              : view === 'preop'
                ? "Patients scheduled for tomorrow's list."
                : 'Exceptions first. Everything else is already handled.'}
          </p>
        </div>
      </div>

      {view === 'all' && (
        <div className="stats">
          <div className="stat">
            <div className="k">
              <span className="ico"><IconAlert size={15} /></span>
              Need attention
            </div>
            <div className="v">{preopFlagged.length + recoveryFlagged.length}</div>
            <div className="sub">of {board.preop.length + board.recovery.length} patients</div>
          </div>
          <div className="stat">
            <div className="k">
              <span className="ico"><IconCalendar size={15} /></span>
              Scheduled tomorrow
            </div>
            <div className="v">{board.preop.length}</div>
            <div className="sub">{notCalled.length} not yet called</div>
          </div>
          <div className="stat">
            <div className="k">
              <span className="ico"><IconPulse size={15} /></span>
              In recovery
            </div>
            <div className="v">{board.recovery.length}</div>
            <div className="sub">{board.recovery.filter((c) => c.state === 'off-track').length} off track</div>
          </div>
          <div className="stat">
            <div className="k">
              <span className="ico"><IconShieldCheck size={15} /></span>
              Cleared without review
            </div>
            <div className="v">{board.preop.filter((c) => c.readiness === 'ready').length}</div>
            <div className="sub">no coordinator time spent</div>
          </div>
        </div>
      )}

      {showRecovery && (
        <section className="section">
          <div className="section-head">
            <h2>Recovery</h2>
            <span className="hint">Insole pressure, updated every 24 hours</span>
          </div>
          <div className="card">
            <div className="rows">
              {board.recovery.map((item) => (
                <RecoveryRow key={item.patientId} item={item} onOpen={() => navigate(`/recovery/${item.patientId}`)} />
              ))}
              {board.recovery.length === 0 && <div className="muted-block">No patients in recovery monitoring.</div>}
            </div>
          </div>
        </section>
      )}

      {showPreop && (
        <section className="section">
          <div className="section-head">
            <h2>Pre-op readiness</h2>
            <span className="hint">Tomorrow's list</span>
          </div>
          <div className="card">
            <div className="rows">
              {[...board.preop]
                .sort((a, b) => {
                  const rank = { 'clinical-review': 0, 'needs-attention': 1, unknown: 2, ready: 3 };
                  return rank[a.readiness] - rank[b.readiness] || (a.start ?? '').localeCompare(b.start ?? '');
                })
                .map((item) => (
                  <PreopRow key={item.patientId} item={item} onOpen={() => navigate(`/preop/${item.patientId}`)} />
                ))}
              {board.preop.length === 0 && <div className="muted-block">Nothing scheduled.</div>}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
