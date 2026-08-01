import type { JSX } from 'react';
import { useParams } from 'react-router';
import { BackLink } from '../components/BackLink';
import { StatusPill } from '../components/StatusPill';
import { VoicePanel } from '../components/VoicePanel';
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
    <>
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
        <div
          className="card"
          style={{
            marginBottom: 18,
            // Border tracks the same severity as the pill beside it.
            borderColor: `color-mix(in srgb, var(--${item.readiness === 'clinical-review' ? 'critical' : 'warning'}) 40%, var(--border))`,
          }}
        >
          <div className="card-body" style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <StatusPill tone={READINESS_TONE[item.readiness]} label="Action" />
            <p style={{ margin: 0 }}>{item.barrier}</p>
          </div>
        </div>
      )}

      <div className="detail-grid">
        <div className="card">
          <div className="card-head">
            <h2>Readiness call</h2>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>patient's own words</span>
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
        </div>

        <VoicePanel
          mode={item.checks.length === 0 ? 'patient' : 'clinician'}
          subject={item.name}
          context={`${item.name}, ${item.procedure}${item.start ? `, scheduled ${item.start}` : ''}. Readiness: ${READINESS_LABEL[item.readiness]}.${item.barrier ? ` Barrier: ${item.barrier}` : ''}`}
        />
      </div>
    </>
  );
}
