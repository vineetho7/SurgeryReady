import type { JSX } from 'react';
import { PlantarPressure } from '../components/PlantarPressure';
import { StatusPill } from '../components/StatusPill';
import { TrendChart } from '../components/TrendChart';
import { useBoard } from '../lib/fhir';
import type { Tone } from '../lib/model';

/**
 * Visual harness.
 *
 * Renders every visual component so the layout, colors, and dark mode can be checked
 * in one place. Not linked from the app — reachable at /preview only.
 *
 * The board rows below are fixtures, but the asymmetry trend is the real thing: it
 * reads the `recovery-report-24h` DiagnosticReports and their Observations out of
 * Medplum, same load as the recovery detail page, so the chart shown here is the chart
 * the project's data actually produces.
 */

interface PreviewRow {
  when: string;
  who: string;
  what: string;
  tone: Tone;
  label: string;
  flag: string;
}

const ROWS: PreviewRow[] = [
  { when: 'POD 4', who: 'Rosa Iqbal', what: 'Lisfranc fixation', tone: 'critical', label: 'Off track', flag: 'flagged' },
  { when: 'POD 6', who: 'Marcus Bell', what: 'Ankle ORIF', tone: 'warning', label: 'Watch', flag: 'flagged-warn' },
  { when: 'POD 12', who: 'Ana Delgado', what: 'Hallux valgus correction', tone: 'good', label: 'On track', flag: '' },
  { when: '07:30', who: 'Maria Santos', what: 'Colonoscopy', tone: 'neutral', label: 'Not yet called', flag: '' },
];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '·';
}

function Chevron(): JSX.Element {
  return (
    <svg className="chev" width="15" height="15" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M6 3.5L10.5 8 6 12.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function PreviewPage(): JSX.Element {
  const { board, loading, error } = useBoard();

  /*
   * Whichever patient has an actual series. The board is sorted worst-first, so this is
   * the off-track case when there is one — the trend worth looking at.
   */
  const trend = board?.recovery.find((c) => c.history.length > 1) ?? board?.recovery[0];

  return (
    <div className="main fade-in" style={{ margin: '0 auto' }}>
      <div className="page-head">
        <div>
          <h1>Visual preview</h1>
          <p className="subtitle">Every component in one place. Asymmetry trend is live from Medplum.</p>
        </div>
        <StatusPill tone="critical" label="Off track" />
      </div>

      <section className="section">
        <div className="section-head">
          <h2>Board rows</h2>
          <span className="hint">all four status tones</span>
        </div>
        <div className="card">
          <div className="rows">
            {ROWS.map((row) => (
              <div className={`row ${row.flag}`} key={row.who}>
                <span className="when">{row.when}</span>
                <span className="avatar" aria-hidden="true">{initials(row.who)}</span>
                <span className="who">
                  <span className="name">{row.who}</span>
                  <span className="proc">{row.what}</span>
                </span>
                <StatusPill tone={row.tone} label={row.label} />
                <Chevron />
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="detail-grid">
        <div className="stack">
          <div className="card">
            <div className="card-head">
              <h2>24-hour report</h2>
              <span className="meta">preview</span>
            </div>
            <div className="card-body">
              <p className="conclusion" style={{ margin: 0 }}>
                Post-op day 4, lisfranc fixation, right side. Off track. Load asymmetry 18%. 52% of stance time outside
                the partial weight-bearing band. Loading beyond the partial weight-bearing limit at hallux, 1st
                metatarsal, heel.
              </p>
            </div>
          </div>

          <PlantarPressure />

          <div className="card">
            <div className="card-head">
              <h2>Asymmetry trend</h2>
              <span className="meta">
                {trend ? `${trend.name} · ${trend.history.length} days from Medplum` : 'from Medplum'}
              </span>
            </div>
            <div className="card-body">
              {loading ? (
                <div className="muted-block">Loading reports from Medplum…</div>
              ) : error ? (
                <div className="muted-block">Medplum: {error.message}</div>
              ) : trend ? (
                <TrendChart history={trend.history} />
              ) : (
                <div className="muted-block">No recovery-report-24h reports in this project.</div>
              )}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h2>Status tones</h2>
          </div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-start' }}>
            <StatusPill tone="good" label="On track" />
            <StatusPill tone="warning" label="Watch" />
            <StatusPill tone="critical" label="Off track" />
            <StatusPill tone="neutral" label="Not yet called" />
          </div>
        </div>
      </div>
    </div>
  );
}
