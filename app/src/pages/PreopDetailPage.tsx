import type { JSX } from 'react';
import { useParams } from 'react-router';
import { BackLink } from '../components/BackLink';
import { RelevantHistory } from '../components/RelevantHistory';
import { StatusPill } from '../components/StatusPill';
import { useBoard } from '../lib/fhir';
import { CHECK_LABEL, READINESS_LABEL, READINESS_TONE, type CheckResult, type Tone } from '../lib/model';

const RESULT_TONE: Record<CheckResult, Tone> = {
  confirmed: 'good',
  barrier: 'warning',
  clinical: 'critical',
};

const RESULT_LABEL: Record<CheckResult, string> = {
  confirmed: 'Confirmed',
  barrier: 'Barrier',
  clinical: 'Clinical review',
};

export function PreopDetailPage(): JSX.Element {
  const { patientId } = useParams();
  const { board, loading } = useBoard();

  if (loading) {
    return <div className="muted-block">Loading…</div>;
  }
  const item = board?.preop.find((c) => c.patientId === patientId);
  if (!item) {
    return <div className="muted-block">Patient not found on the board.</div>;
  }

  return (
    <div className="fade-in">
      <BackLink to="/preop">Pre-op readiness</BackLink>

      <div className="page-head">
        <div>
          <h1>{item.name}</h1>
          <p className="subtitle">
            {item.procedure}
            {item.start ? ` · ${new Date(item.start).toLocaleString([], { weekday: 'long', hour: '2-digit', minute: '2-digit' })}` : ''}
          </p>
        </div>
        <StatusPill tone={READINESS_TONE[item.readiness]} label={READINESS_LABEL[item.readiness]} />
      </div>

      {item.barrier && (
        <div className="callout" data-tone={item.readiness === 'clinical-review' ? 'critical' : 'warning'}>
          <StatusPill tone={READINESS_TONE[item.readiness]} label="Action" />
          <p>{item.barrier}</p>
        </div>
      )}

      <div className="card">
        <div className="card-head">
          <h2>Readiness call</h2>
          <span className="meta">patient's own words</span>
        </div>
        {item.checks.length === 0 ? (
          <div className="muted-block">This patient has not been called yet.</div>
        ) : (
          <div className="checks">
            {item.checks.map((check) => (
              <div className="check" key={check.id}>
                <span className="label">{CHECK_LABEL[check.id]}</span>
                <span className="said">“{check.utterance}”</span>
                <StatusPill tone={RESULT_TONE[check.result]} label={RESULT_LABEL[check.result]} />
              </div>
            ))}
          </div>
        )}

        {/* Coverage is checked, not asked. It belongs with the six spoken checks because
            it can send a patient home from the desk just as surely as a missing driver,
            but it is never something the patient can answer for. */}
        {item.coverage && (
          <div className="checks">
            <div className="check">
              <span className="label">Insurance coverage</span>
              <span className="said" style={{ fontStyle: 'normal' }}>
                {item.coverage.disposition}
              </span>
              <StatusPill
                tone={item.coverage.verified ? 'good' : 'warning'}
                label={item.coverage.verified ? 'Verified' : 'Unverified'}
              />
            </div>
          </div>
        )}
      </div>

      <div style={{ marginTop: 18 }}>
        <RelevantHistory conditions={item.history} />
      </div>
    </div>
  );
}
