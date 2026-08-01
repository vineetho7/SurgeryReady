import type { JSX } from 'react';
import { FootMap } from '../components/FootMap';
import { IconGauge, IconLayers, IconTarget, IconWalk } from '../components/icons';
import { PlantarPressure } from '../components/PlantarPressure';
import { StatusPill } from '../components/StatusPill';
import { TrendChart } from '../components/TrendChart';
import type { RecoveryDay, ZoneReading } from '../lib/fhir';
import type { Tone } from '../lib/model';

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
  return (
    <div className="main fade-in" style={{ margin: '0 auto' }}>
      <div className="page-head">
        <div>
          <h1>Visual preview</h1>
          <p className="subtitle">Every component against fixed data. No authentication.</p>
        </div>
        <StatusPill tone="critical" label="Off track" />
      </div>

      <div className="stats">
        <div className="stat">
          <div className="k">
            <span className="ico"><IconGauge size={15} /></span>
            Load asymmetry
          </div>
          <div className="v">31%</div>
          <div className="sub">
            <span className="up">8 pts better than yesterday</span>
          </div>
        </div>
        <div className="stat">
          <div className="k">
            <span className="ico"><IconTarget size={15} /></span>
            Expected today
          </div>
          <div className="v">35%</div>
          <div className="sub">by the weight-bearing protocol</div>
        </div>
        <div className="stat">
          <div className="k">
            <span className="ico"><IconWalk size={15} /></span>
            Walking captured
          </div>
          <div className="v">
            38<span className="unit">min</span>
          </div>
          <div className="sub">stance time in last 24h</div>
        </div>
        <div className="stat">
          <div className="k">
            <span className="ico"><IconLayers size={15} /></span>
            Sessions
          </div>
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

          <div className="card">
            <div className="card-head">
              <h2>Plantar pressure — right foot</h2>
              <span className="meta">peak per zone vs protocol band</span>
            </div>
            <div className="card-body">
              <FootMap zones={ZONES} side="right foot" />
            </div>
          </div>

          <PlantarPressure />

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
