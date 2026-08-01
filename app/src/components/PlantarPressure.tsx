import type { JSX } from 'react';
import {
  INSOLE_ZONE_LABEL,
  asymmetry,
  scaleMaxOf,
  useRecordings,
  zoneValue,
  type InsoleRecording,
  type Statistic,
} from '../lib/insole';
import { HeatScale, InsoleFootMap } from './InsoleFootMap';

/**
 * Plantar pressure from a recorded insole session: mean and peak, side by side.
 *
 * The two statistics answer different questions and a toggle made them impossible to
 * compare, so both are on screen. Mean is where the foot lives over a session — the
 * offloading pattern. Peak is the worst single frame each cell saw, which is what a
 * healing repair actually has to survive. A foot can look balanced in one and not the
 * other.
 *
 * Within a card the two feet share one scale, because a limp is a difference *between*
 * feet and two maps auto-scaled to their own maxima would each look perfectly normal.
 * Across cards the scales differ — mean pressure over a session tops out far below
 * peak, and one ceiling for both would paint the mean map a pale wash — so each card
 * carries its own legend.
 */

const SESSION = ['LEFT_limp_1', 'RIGHT_limp_1'];

function which(recordings: InsoleRecording[], side: 'LEFT' | 'RIGHT'): InsoleRecording | undefined {
  return recordings.find((r) => r.side === side);
}

/** "left" / "right", from the sign of a left-positive asymmetry. */
function heavier(value: number): string {
  return value >= 0 ? 'left' : 'right';
}

function PressureCard({
  feet,
  statistic,
  title,
}: {
  feet: InsoleRecording[];
  statistic: Statistic;
  title: string;
}): JSX.Element {
  const scaleMax = scaleMaxOf(feet, statistic);

  return (
    <div className="card">
      <div className="card-head">
        <h2>{title}</h2>
        <span className="meta">both feet, one shared scale</span>
      </div>
      <div className="card-body">
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
          <HeatScale max={scaleMax} />
        </div>

        <div className="foot-pair">
          {feet.map((recording) => (
            <figure key={recording.side}>
              <InsoleFootMap recording={recording} statistic={statistic} scaleMax={scaleMax} width={176} />
              <figcaption>{recording.side === 'LEFT' ? 'Left foot' : 'Right foot'}</figcaption>
            </figure>
          ))}
        </div>
      </div>
    </div>
  );
}

export function PlantarPressure(): JSX.Element {
  const { recordings, loading, error } = useRecordings(SESSION);

  if (loading) {
    return <div className="muted-block">Loading insole session…</div>;
  }

  const left = recordings && which(recordings, 'LEFT');
  const right = recordings && which(recordings, 'RIGHT');
  if (error || !left || !right) {
    return <div className="muted-block">{error?.message ?? 'This session needs one LEFT and one RIGHT recording.'}</div>;
  }
  const feet = [left, right];

  return (
    <>
      <PressureCard feet={feet} statistic="mean" title="Plantar pressure — mean" />
      <PressureCard feet={feet} statistic="peak" title="Plantar pressure — peak" />

      <div className="card">
        <div className="card-head">
          <h2>By zone</h2>
          <span className="meta">raw sensor units</span>
        </div>
        <div className="card-body">
          {/* The table is the accessible equivalent of the four maps, not an extra. */}
          <table className="data">
            <thead>
              <tr>
                <th>Zone</th>
                <th style={{ textAlign: 'right' }}>Mean L</th>
                <th style={{ textAlign: 'right' }}>Mean R</th>
                <th style={{ textAlign: 'right' }}>Peak L</th>
                <th style={{ textAlign: 'right' }}>Peak R</th>
                <th style={{ textAlign: 'right' }}>Mean difference</th>
              </tr>
            </thead>
            <tbody>
              {left.zones.map((zone, index) => {
                const other = right.zones[index];
                const delta = asymmetry(zone.mean, other.mean);
                return (
                  <tr key={zone.zone}>
                    <td>
                      {INSOLE_ZONE_LABEL[zone.zone]}
                      <span style={{ display: 'block', fontSize: 11.5, color: 'var(--text-muted)' }}>
                        {Math.round(zone.loadShare * 100)}% / {Math.round(other.loadShare * 100)}% of load
                      </span>
                    </td>
                    <td className="num">{zoneValue(zone, 'mean').toFixed(0)}</td>
                    <td className="num">{zoneValue(other, 'mean').toFixed(0)}</td>
                    <td className="num" style={{ color: 'var(--text-secondary)' }}>
                      {zoneValue(zone, 'peak').toFixed(0)}
                    </td>
                    <td className="num" style={{ color: 'var(--text-secondary)' }}>
                      {zoneValue(other, 'peak').toFixed(0)}
                    </td>
                    <td className="num">
                      {Math.abs(delta) < 1 ? 'even' : `${Math.abs(delta).toFixed(0)}% ${heavier(delta)}`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
