import type { JSX } from 'react';
import { FootMap } from '../components/FootMap';
import { StatusPill } from '../components/StatusPill';
import { TrendChart } from '../components/TrendChart';
import type { RecoveryDay, ZoneReading } from '../lib/fhir';

/**
 * Unauthenticated visual harness.
 *
 * Renders every visual component against fixed data so the layout, colors, and dark
 * mode can be checked without a Medplum session. Not linked from the app — reachable
 * at /preview only.
 */

const ZONES: ZoneReading[] = [
  { zone: 'hallux', peakKpa: 96, bandLow: 140, bandHigh: 224, deviationSeconds: 620, contralateralKpa: 288 },
  { zone: 'metatarsal1', peakKpa: 158, bandLow: 130, bandHigh: 208, deviationSeconds: 180, contralateralKpa: 262 },
  { zone: 'metatarsal5', peakKpa: 196, bandLow: 100, bandHigh: 160, deviationSeconds: 940, contralateralKpa: 204 },
  { zone: 'midfoot', peakKpa: 72, bandLow: 55, bandHigh: 88, deviationSeconds: 90, contralateralKpa: 112 },
  { zone: 'heel', peakKpa: 342, bandLow: 150, bandHigh: 240, deviationSeconds: 1180, contralateralKpa: 304 },
];

const HISTORY: RecoveryDay[] = [
  { postOpDay: 0, date: '', asymmetry: 0.72, expectedAsymmetry: 0.75, loadIndex: 0.4, state: 'on-track' },
  { postOpDay: 1, date: '', asymmetry: 0.68, expectedAsymmetry: 0.75, loadIndex: 0.45, state: 'on-track' },
  { postOpDay: 2, date: '', asymmetry: 0.63, expectedAsymmetry: 0.75, loadIndex: 0.5, state: 'on-track' },
  { postOpDay: 3, date: '', asymmetry: 0.58, expectedAsymmetry: 0.55, loadIndex: 0.52, state: 'watch' },
  { postOpDay: 4, date: '', asymmetry: 0.54, expectedAsymmetry: 0.55, loadIndex: 0.55, state: 'on-track' },
  { postOpDay: 5, date: '', asymmetry: 0.49, expectedAsymmetry: 0.55, loadIndex: 0.6, state: 'on-track' },
  { postOpDay: 6, date: '', asymmetry: 0.47, expectedAsymmetry: 0.55, loadIndex: 0.62, state: 'on-track' },
  { postOpDay: 7, date: '', asymmetry: 0.44, expectedAsymmetry: 0.55, loadIndex: 0.64, state: 'on-track' },
  { postOpDay: 8, date: '', asymmetry: 0.39, expectedAsymmetry: 0.35, loadIndex: 0.66, state: 'watch' },
  { postOpDay: 9, date: '', asymmetry: 0.31, expectedAsymmetry: 0.35, loadIndex: 0.7, state: 'on-track' },
];

const ROWS = [
  { when: 'POD 4', who: 'Rosa Iqbal', what: 'Lisfranc fixation', tone: 'critical' as const, label: 'Off track', flagged: true },
  { when: 'POD 6', who: 'Marcus Bell', what: 'Ankle ORIF', tone: 'warning' as const, label: 'Watch', flagged: false },
  { when: 'POD 12', who: 'Ana Delgado', what: 'Hallux valgus correction', tone: 'good' as const, label: 'On track', flagged: false },
  { when: '07:30', who: 'Maria Santos', what: 'Colonoscopy', tone: 'neutral' as const, label: 'Not yet called', flagged: false },
];

export function PreviewPage(): JSX.Element {
  return (
    <div className="main" style={{ margin: '0 auto' }}>
      <div className="page-head">
        <div>
          <h1>Visual preview</h1>
          <p className="subtitle">Every component against fixed data. No authentication.</p>
        </div>
        <StatusPill tone="critical" label="Off track" />
      </div>

      <div className="stats">
        <div className="stat">
          <div className="k">Load asymmetry</div>
          <div className="v">31%</div>
          <div className="sub">
            <span style={{ color: 'var(--good-text)' }}>↓ 8 pts since yesterday</span>
          </div>
        </div>
        <div className="stat">
          <div className="k">Expected today</div>
          <div className="v">35%</div>
          <div className="sub">by the weight-bearing protocol</div>
        </div>
        <div className="stat">
          <div className="k">Walking captured</div>
          <div className="v">
            38<span style={{ fontSize: 15, fontWeight: 500 }}> min</span>
          </div>
          <div className="sub">stance time in last 24h</div>
        </div>
        <div className="stat">
          <div className="k">Sessions</div>
          <div className="v">10</div>
          <div className="sub">days of insole data</div>
        </div>
      </div>

      <section className="section">
        <div className="section-head">
          <h2>Board rows</h2>
          <span className="hint">all four status tones</span>
        </div>
        <div className="card">
          <div className="rows">
            {ROWS.map((row) => (
              <div className={`row ${row.flagged ? 'flagged' : ''}`} key={row.who}>
                <span className="when">{row.when}</span>
                <span className="who">{row.who}</span>
                <span className="what">{row.what}</span>
                <StatusPill tone={row.tone} label={row.label} />
                <svg className="chev" width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
                  <path d="M6 3.5L10.5 8 6 12.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
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
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>preview</span>
            </div>
            <div className="card-body">
              <p className="conclusion" style={{ margin: 0 }}>
                Post-op day 4, lisfranc fixation, right side. Off track. Load asymmetry 18%. 52% of stance time outside
                the partial weight-bearing band. Loading beyond the partial weight-bearing limit at hallux, 1st
                metatarsal, heel.
              </p>
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <h2>Plantar pressure — right foot</h2>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>peak per zone vs protocol band</span>
            </div>
            <div className="card-body">
              <FootMap zones={ZONES} side="right foot" />
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <h2>Asymmetry trend</h2>
            </div>
            <div className="card-body">
              <TrendChart history={HISTORY} />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h2>Status tones</h2>
          </div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-start' }}>
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
