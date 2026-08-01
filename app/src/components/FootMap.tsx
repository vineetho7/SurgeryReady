import { useState, type JSX } from 'react';
import type { ZoneReading } from '../lib/fhir';
import { ZONE_LABEL, type Zone } from '../lib/model';

/**
 * Plantar pressure map.
 *
 * Deviation from the expected band is *polarity*, not magnitude — a zone can be wrong
 * in two opposite directions and the difference matters clinically. So this uses the
 * diverging blue↔red pair with a neutral midpoint: blue is under-loaded, neutral is
 * inside the protocol band, red is loaded past what the repair should take.
 */

interface ZoneGeometry {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

const GEOMETRY: Record<Zone, ZoneGeometry> = {
  hallux: { cx: 44, cy: 52, rx: 17, ry: 21 },
  metatarsal1: { cx: 48, cy: 108, rx: 20, ry: 17 },
  metatarsal5: { cx: 94, cy: 116, rx: 18, ry: 16 },
  midfoot: { cx: 92, cy: 175, rx: 15, ry: 30 },
  heel: { cx: 68, cy: 244, rx: 27, ry: 32 },
};

const OUTLINE =
  'M70 12 C100 12 118 40 116 78 C114 110 104 128 100 150 C96 172 100 190 102 208 C105 240 92 292 68 292 C44 292 31 240 34 208 C36 190 40 172 36 150 C32 128 22 110 20 78 C18 40 40 12 70 12 Z';

const LESSER_TOES = [
  { cx: 76, cy: 40, r: 8 },
  { cx: 92, cy: 46, r: 7.5 },
  { cx: 105, cy: 56, r: 6.5 },
  { cx: 113, cy: 70, r: 5.5 },
];

/** Where the reading sits relative to its band: <0 under, 0–1 inside, >1 over. */
function bandPosition(reading: ZoneReading): number {
  const span = reading.bandHigh - reading.bandLow;
  return span === 0 ? 0 : (reading.peakKpa - reading.bandLow) / span;
}

/** Diverging fill. Inside the band stays near neutral; the arms saturate as it drifts. */
function fillFor(reading: ZoneReading): string {
  const t = bandPosition(reading);
  if (t < 0) {
    const strength = Math.min(1, -t);
    return `color-mix(in srgb, var(--diverge-low) ${Math.round(18 + strength * 72)}%, var(--diverge-mid))`;
  }
  if (t > 1) {
    const strength = Math.min(1, t - 1);
    return `color-mix(in srgb, var(--diverge-high) ${Math.round(24 + strength * 70)}%, var(--diverge-mid))`;
  }
  return 'var(--diverge-mid)';
}

function statusWord(reading: ZoneReading): string {
  const t = bandPosition(reading);
  if (t < 0) {
    return 'below band';
  }
  if (t > 1) {
    return 'above band';
  }
  return 'in band';
}

export function FootMap({ zones, side }: { zones: ZoneReading[]; side: string }): JSX.Element {
  const [hover, setHover] = useState<ZoneReading>();

  return (
    <div>
      <div style={{ display: 'flex', gap: 22, alignItems: 'flex-start' }}>
        <svg viewBox="0 0 140 304" width="150" height="326" role="img" aria-label={`Plantar pressure map, ${side}`}>
          <path d={OUTLINE} fill="var(--surface-sunken)" stroke="var(--border-strong)" strokeWidth="1" />
          {LESSER_TOES.map((toe) => (
            <circle key={toe.cx} cx={toe.cx} cy={toe.cy} r={toe.r} fill="var(--surface-sunken)" stroke="var(--border-strong)" strokeWidth="1" />
          ))}
          {zones.map((reading) => {
            const g = GEOMETRY[reading.zone];
            const active = hover?.zone === reading.zone;
            return (
              <ellipse
                key={reading.zone}
                cx={g.cx}
                cy={g.cy}
                rx={g.rx}
                ry={g.ry}
                fill={fillFor(reading)}
                // 2px surface ring keeps overlapping marks separated.
                stroke={active ? 'var(--text-primary)' : 'var(--surface)'}
                strokeWidth="2"
                style={{ cursor: 'pointer', transition: 'stroke 120ms' }}
                onMouseEnter={() => setHover(reading)}
                onMouseLeave={() => setHover(undefined)}
              >
                <title>{`${ZONE_LABEL[reading.zone]}: ${reading.peakKpa} kPa (${statusWord(reading)})`}</title>
              </ellipse>
            );
          })}
        </svg>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="scale" style={{ marginBottom: 12 }}>
            <span>Under</span>
            <span className="scale-bar" />
            <span>Over</span>
          </div>

          {/* The table view is the accessible equivalent of the map, not an extra. */}
          <table className="data">
            <thead>
              <tr>
                <th>Zone</th>
                <th style={{ textAlign: 'right' }}>Peak</th>
                <th style={{ textAlign: 'right' }}>Band</th>
                <th style={{ textAlign: 'right' }}>Out of band</th>
              </tr>
            </thead>
            <tbody>
              {zones.map((reading) => (
                <tr
                  key={reading.zone}
                  onMouseEnter={() => setHover(reading)}
                  onMouseLeave={() => setHover(undefined)}
                  style={{ background: hover?.zone === reading.zone ? 'var(--surface-sunken)' : undefined }}
                >
                  <td>
                    <span
                      className="swatch"
                      style={{ background: fillFor(reading), display: 'inline-block', marginRight: 8, verticalAlign: -1 }}
                    />
                    {ZONE_LABEL[reading.zone]}
                  </td>
                  <td className="num">{reading.peakKpa} kPa</td>
                  <td className="num" style={{ color: 'var(--text-muted)' }}>
                    {reading.bandLow}–{reading.bandHigh}
                  </td>
                  <td className="num">{Math.round(reading.deviationSeconds / 60)} min</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
