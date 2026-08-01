import type { JSX } from 'react';
import { useParams } from 'react-router';
import { BackLink, Delta } from '../components/BackLink';
import { FootMap } from '../components/FootMap';
import { PlantarPressure } from '../components/PlantarPressure';
import { RelevantHistory } from '../components/RelevantHistory';
import { IconGauge, IconLayers, IconTarget, IconWalk } from '../components/icons';
import { StatusPill } from '../components/StatusPill';
import { TrendChart } from '../components/TrendChart';
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
    <div className="fade-in">
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
          <div className="k">
            <span className="ico"><IconGauge size={15} /></span>
            Load asymmetry
          </div>
          <div className="v">{Math.round((latest?.asymmetry ?? 0) * 100)}%</div>
          <div className="sub">{gapLabel}</div>
        </div>
        <div className="stat">
          <div className="k">
            <span className="ico"><IconTarget size={15} /></span>
            Expected today
          </div>
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
          <div className="k">
            <span className="ico"><IconWalk size={15} /></span>
            Walking captured
          </div>
          <div className="v">
            {item.stanceMinutes}
            <span className="unit">min</span>
          </div>
          <div className="sub">stance time in last 24h</div>
        </div>
        <div className="stat">
          <div className="k">
            <span className="ico"><IconLayers size={15} /></span>
            Sessions
          </div>
          <div className="v">{item.history.length}</div>
          <div className="sub">days of insole data</div>
        </div>
      </div>

      <div className="detail-cols">
        <div className="card">
          <div className="card-head">
            <h2>24-hour report</h2>
            <span className="meta">{item.issued ? new Date(item.issued).toLocaleString() : ''}</span>
          </div>
          <div className="card-body">
            <p className="conclusion" style={{ margin: 0 }}>
              {item.conclusion}
            </p>
          </div>
        </div>

        <RelevantHistory conditions={item.conditions} />

        <div className="card">
          <div className="card-head">
            <h2>Plantar pressure — {item.side}</h2>
            <span className="meta">peak per zone vs protocol band</span>
          </div>
          <div className="card-body">
            <FootMap zones={item.zones} side={item.side} />
          </div>
        </div>

        <PlantarPressure />

        <div className="card">
          <div className="card-head">
            <h2>Asymmetry trend</h2>
          </div>
          <div className="card-body">
            <TrendChart history={item.history} />
          </div>
        </div>
      </div>
    </div>
  );
}
