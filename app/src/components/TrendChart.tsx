import { useState, type JSX, type MouseEvent } from 'react';
import type { RecoveryDay } from '../lib/fhir';

/**
 * Load asymmetry against the asymmetry the protocol expects, by post-op day.
 *
 * Both series are the same unit on the same scale, so they share one axis — the gap
 * between the lines *is* the finding. Two measures of different scale would have to be
 * two charts; they are never two y-axes.
 */

const W = 560;
const H = 210;
const PAD = { top: 14, right: 46, bottom: 44, left: 40 };

export function TrendChart({ history }: { history: RecoveryDay[] }): JSX.Element {
  const [hoverIndex, setHoverIndex] = useState<number>();

  if (history.length < 2) {
    return <div className="muted-block">Not enough sessions yet to plot a trend.</div>;
  }

  const days = history.map((d) => d.postOpDay);
  const minDay = Math.min(...days);
  const maxDay = Math.max(...days);
  // Only some writers record the protocol band; without it this is a one-series chart.
  const expected = history.every((d) => d.expectedAsymmetry !== undefined);
  const maxValue = Math.max(0.6, ...history.map((d) => Math.max(d.asymmetry, d.expectedAsymmetry ?? 0))) * 1.12;

  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const x = (day: number): number => PAD.left + (maxDay === minDay ? 0 : ((day - minDay) / (maxDay - minDay)) * plotW);
  const y = (value: number): number => PAD.top + plotH - (value / maxValue) * plotH;

  const line = (pick: (d: RecoveryDay) => number): string =>
    history.map((d, i) => `${i === 0 ? 'M' : 'L'}${x(d.postOpDay).toFixed(1)} ${y(pick(d)).toFixed(1)}`).join(' ');

  const ticks = [0, 0.2, 0.4, 0.6].filter((t) => t <= maxValue);
  const last = history[history.length - 1];
  const hovered = hoverIndex === undefined ? undefined : history[hoverIndex];

  function onMove(event: MouseEvent<SVGSVGElement>): void {
    const rect = event.currentTarget.getBoundingClientRect();
    const px = ((event.clientX - rect.left) / rect.width) * W;
    let nearest = 0;
    let best = Infinity;
    history.forEach((d, i) => {
      const distance = Math.abs(x(d.postOpDay) - px);
      if (distance < best) {
        best = distance;
        nearest = i;
      }
    });
    setHoverIndex(nearest);
  }

  return (
    <div>
      <div className="legend" style={{ marginBottom: 10 }}>
        <span className="item">
          <span className="swatch" style={{ background: 'var(--series-1)' }} />
          Measured asymmetry
        </span>
        {expected && (
          <span className="item">
            <span className="swatch" style={{ background: 'var(--series-2)' }} />
            Expected for the day
          </span>
        )}
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        style={{ display: 'block', overflow: 'visible' }}
        onMouseMove={onMove}
        onMouseLeave={() => setHoverIndex(undefined)}
        role="img"
        aria-label={
          expected ? 'Load asymmetry against expected, by post-operative day' : 'Load asymmetry by post-operative day'
        }
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--gridline)" strokeWidth="1" />
            <text x={PAD.left - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--text-muted)">
              {Math.round(t * 100)}%
            </text>
          </g>
        ))}

        <line x1={PAD.left} x2={W - PAD.right} y1={PAD.top + plotH} y2={PAD.top + plotH} stroke="var(--axis)" strokeWidth="1" />

        {history.map((d, i) => (
          <text key={`lbl-${i}`} x={x(d.postOpDay)} y={H - 26} textAnchor="middle" fontSize="11" fill="var(--text-muted)">
            {d.postOpDay}
          </text>
        ))}

        {expected && (
          <path d={line((d) => d.expectedAsymmetry ?? 0)} fill="none" stroke="var(--series-2)" strokeWidth="2" strokeDasharray="5 4" />
        )}
        <path d={line((d) => d.asymmetry)} fill="none" stroke="var(--series-1)" strokeWidth="2" strokeLinejoin="round" />

        {history.map((d, i) => (
          <circle
            key={`pt-${i}`}
            cx={x(d.postOpDay)}
            cy={y(d.asymmetry)}
            r={hoverIndex === i ? 5.5 : 4}
            fill="var(--series-1)"
            stroke="var(--surface)"
            strokeWidth="2"
          />
        ))}

        {/* Direct label on the last point — identity never rests on color alone. */}
        <text x={x(last.postOpDay) + 9} y={y(last.asymmetry) + 4} fontSize="11.5" fill="var(--text-secondary)">
          {Math.round(last.asymmetry * 100)}%
        </text>

        {hovered && (
          <g pointerEvents="none">
            <line
              x1={x(hovered.postOpDay)}
              x2={x(hovered.postOpDay)}
              y1={PAD.top}
              y2={PAD.top + plotH}
              stroke="var(--axis)"
              strokeWidth="1"
            />
            {expected && (
              <circle cx={x(hovered.postOpDay)} cy={y(hovered.expectedAsymmetry ?? 0)} r="4" fill="var(--series-2)" stroke="var(--surface)" strokeWidth="2" />
            )}
          </g>
        )}

        {/* Centred on its own line below the ticks so it can never collide with one. */}
        <text x={(PAD.left + (W - PAD.right)) / 2} y={H - 6} textAnchor="middle" fontSize="11" fill="var(--text-muted)">
          post-op day
        </text>
      </svg>

      <div style={{ minHeight: 22, marginTop: 6, fontSize: 13, color: 'var(--text-secondary)' }}>
        {hovered ? (
          <>
            <strong style={{ color: 'var(--text-primary)' }}>Day {hovered.postOpDay}</strong> — measured{' '}
            {Math.round(hovered.asymmetry * 100)}%
            {hovered.expectedAsymmetry !== undefined && `, expected ${Math.round(hovered.expectedAsymmetry * 100)}%`}
          </>
        ) : (
          <span style={{ color: 'var(--text-muted)' }}>Hover the chart for a day-by-day reading.</span>
        )}
      </div>
    </div>
  );
}
