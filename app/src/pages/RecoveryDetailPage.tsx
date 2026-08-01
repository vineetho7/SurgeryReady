import type { JSX } from 'react';
import { useParams } from 'react-router';
import { BackLink } from '../components/BackLink';
import { PlantarPressure } from '../components/PlantarPressure';
import { RelevantHistory } from '../components/RelevantHistory';
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

  return (
    <div className="fade-in">
      <BackLink to="/recovery">Recovery</BackLink>

      <div className="page-head">
        <div>
          <h1>{item.name}</h1>
          <p className="subtitle">
            {item.procedure} · {item.side} · post-op day {item.postOpDay}
          </p>
          <RelevantHistory conditions={item.conditions} inline />
        </div>
        <StatusPill tone={RECOVERY_TONE[item.state]} label={RECOVERY_LABEL[item.state]} />
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
