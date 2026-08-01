import type { JSX } from 'react';
import { useParams } from 'react-router';
import { BackLink, Delta } from '../components/BackLink';
import { FootMap } from '../components/FootMap';
import { StatusPill } from '../components/StatusPill';
import { TrendChart } from '../components/TrendChart';
import { VoicePanel } from '../components/VoicePanel';
import { useBoard } from '../lib/fhir';
import { RECOVERY_LABEL, RECOVERY_TONE } from '../lib/model';

export function RecoveryDetailPage(): JSX.Element {
  const { patientId } = useParams();
  const { board, loading } = useBoard();

  if (loading) {
    return <div className="muted-block">Loading…</div>;
  }
  const item = board?.recovery.find((c) => c.patientId === patientId);
  if (!item) {
    return <div className="muted-block">Patient not found in recovery monitoring.</div>;
  }

  const previous = item.history.length > 1 ? item.history[item.history.length - 2] : undefined;
  const latest = item.history[item.history.length - 1];
  const delta = previous && latest ? latest.asymmetry - previous.asymmetry : undefined;

  /*
   * The number that carries the finding is the gap to expectation, not the raw value
   * or the day-over-day change. Asymmetry far *below* the protocol's expectation means
   * the patient is loading a foot that is supposed to be protected — which reads as a
   * healthy-looking 8% unless the card says otherwise.
   */
  const gap = latest ? Math.round((latest.asymmetry - latest.expectedAsymmetry) * 100) : 0;
  const gapLabel =
    Math.abs(gap) <= 5
      ? 'in line with the protocol'
      : gap < 0
        ? `${Math.abs(gap)} pts below expected — loading ahead of protocol`
        : `${gap} pts above expected — not taking its share`;

  return (
    <>
      <BackLink to="/recovery">Recovery</BackLink>

      <div className="page-head">
        <div>
          <h1>{item.name}</h1>
          <p className="subtitle">
            {item.procedure} · {item.side} · post-op day {item.postOpDay}
          </p>
        </div>
        <StatusPill tone={RECOVERY_TONE[item.state]} label={RECOVERY_LABEL[item.state]} />
      </div>

      <div className="stats">
        <div className="stat">
          <div className="k">Load asymmetry</div>
          <div className="v">{Math.round((latest?.asymmetry ?? 0) * 100)}%</div>
          <div className="sub">{gapLabel}</div>
        </div>
        <div className="stat">
          <div className="k">Expected today</div>
          <div className="v">{Math.round((latest?.expectedAsymmetry ?? 0) * 100)}%</div>
          <div className="sub">
            {delta === undefined ? (
              'first session'
            ) : Math.round(delta * 100) === 0 ? (
              'unchanged since yesterday'
            ) : (
              <Delta value={Math.round(delta * 100)} unit="pt" />
            )}
          </div>
        </div>
        <div className="stat">
          <div className="k">Walking captured</div>
          <div className="v">{item.stanceMinutes}<span style={{ fontSize: 15, fontWeight: 500 }}> min</span></div>
          <div className="sub">stance time in last 24h</div>
        </div>
        <div className="stat">
          <div className="k">Sessions</div>
          <div className="v">{item.history.length}</div>
          <div className="sub">days of insole data</div>
        </div>
      </div>

      <div className="detail-grid">
        <div className="stack">
          <div className="card">
            <div className="card-head">
              <h2>24-hour report</h2>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {item.issued ? new Date(item.issued).toLocaleString() : ''}
              </span>
            </div>
            <div className="card-body">
              <p className="conclusion" style={{ margin: 0 }}>
                {item.conclusion}
              </p>
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <h2>Plantar pressure — {item.side}</h2>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>peak per zone vs protocol band</span>
            </div>
            <div className="card-body">
              <FootMap zones={item.zones} side={item.side} />
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <h2>Asymmetry trend</h2>
            </div>
            <div className="card-body">
              <TrendChart history={item.history} />
            </div>
          </div>
        </div>

        <VoicePanel
          mode="clinician"
          subject={item.name}
          context={`${item.name}, ${item.procedure}, ${item.side}, post-op day ${item.postOpDay}. ${item.conclusion}`}
        />
      </div>
    </>
  );
}
