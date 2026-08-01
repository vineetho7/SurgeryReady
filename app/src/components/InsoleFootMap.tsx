import { useId, useMemo, useState, type JSX } from 'react';
import {
  HEAT_MIN,
  INSOLE_ZONE_LABEL,
  INSOLE_ZONE_SHORT,
  gridFor,
  heatCss,
  heatPosition,
  heatRgb,
  zoneValue,
  type InsoleRecording,
  type InsoleZone,
  type Statistic,
} from '../lib/insole';
import { GRID_BOX, OUTLINE, VIEW_H, VIEW_W, flipX, sideLabels, type Foot } from './footShape';

/**
 * The insole's 16 x 8 sensor grid, drawn inside the app's foot.
 *
 * The acquisition tool renders this grid as a bare rectangle, which is what the
 * hardware is but not what anyone is looking at. Here the same oriented grid is laid
 * over the silhouette's bounding box and clipped to the outline, so a hot spot sits
 * where the clinician expects that part of the foot to be. Nothing is resampled to
 * make it fit: cell (row, col) lands in a fixed place, and the parts of the rectangle
 * outside the foot are simply not drawn — the same cells that sit under no foot on
 * the physical insole.
 */

/**
 * Bilinear upscale of the grid, as a data URL.
 *
 * Painting 128 discrete rects would draw the sensor layout; the reader is trying to
 * see the load distribution, which is continuous. So the browser's own image
 * smoothing does the interpolation, and the mesh stays out of the picture.
 */
function heatDataUrl(grid: number[][], scaleMax: number): string {
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  if (!rows || !cols) {
    return '';
  }

  const cells = document.createElement('canvas');
  cells.width = cols;
  cells.height = rows;
  const cellCtx = cells.getContext('2d');
  if (!cellCtx) {
    return '';
  }
  const image = cellCtx.createImageData(cols, rows);
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const [r, g, b] = heatRgb(heatPosition(grid[row][col], scaleMax));
      const at = (row * cols + col) * 4;
      image.data[at] = r;
      image.data[at + 1] = g;
      image.data[at + 2] = b;
      image.data[at + 3] = 255;
    }
  }
  cellCtx.putImageData(image, 0, 0);

  const smooth = document.createElement('canvas');
  smooth.width = cols * 32;
  smooth.height = rows * 32;
  const ctx = smooth.getContext('2d');
  if (!ctx) {
    return '';
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(cells, 0, 0, smooth.width, smooth.height);
  return smooth.toDataURL();
}

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

function zoneBox(zone: InsoleZone, rows: number, cols: number): Box {
  const cellW = GRID_BOX.width / cols;
  const cellH = GRID_BOX.height / rows;
  return {
    x: GRID_BOX.x + zone.cols[0] * cellW,
    y: GRID_BOX.y + zone.rows[0] * cellH,
    width: (zone.cols[1] - zone.cols[0]) * cellW,
    height: (zone.rows[1] - zone.rows[0]) * cellH,
  };
}

/**
 * A value pinned to a zone — name over number, so the pill stays narrower than the
 * foot. Kept upright when the drawing is mirrored, and nudged back inside the frame
 * when its zone sits near an edge.
 */
function ZoneLabel({ x, y, name, value, foot }: { x: number; y: number; name: string; value: string; foot: Foot }): JSX.Element {
  const width = Math.max(name.length * 5.4, 22) + 12;
  const cx = Math.min(Math.max(flipX(x, foot), width / 2 + 2), VIEW_W - width / 2 - 2);

  return (
    <g transform={`translate(${cx} ${y})`} style={{ pointerEvents: 'none' }}>
      <rect
        x={-width / 2}
        y={-13}
        width={width}
        height={26}
        rx={6}
        fill="var(--surface)"
        stroke="var(--border-strong)"
        strokeWidth={0.8}
        opacity={0.95}
      />
      <text textAnchor="middle" y={-2} fontSize={8.5} fontWeight={550} fill="var(--text-secondary)">
        {name}
      </text>
      <text textAnchor="middle" y={9} fontSize={11} fontWeight={700} fill="var(--text-primary)">
        {value}
      </text>
    </g>
  );
}

export function InsoleFootMap({
  recording,
  statistic,
  scaleMax,
  width = 168,
}: {
  recording: InsoleRecording;
  statistic: Statistic;
  /** Shared across both feet, so the two maps can be compared by eye. */
  scaleMax: number;
  width?: number;
}): JSX.Element {
  const clipId = useId();
  const [hover, setHover] = useState<InsoleZone>();

  const foot: Foot = recording.side === 'LEFT' ? 'left' : 'right';
  const grid = gridFor(recording, statistic);

  const href = useMemo(() => heatDataUrl(grid, scaleMax), [grid, scaleMax]);
  const edges = sideLabels(foot);

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      width={width}
      height={(width * VIEW_H) / VIEW_W}
      role="img"
      aria-label={`Insole pressure map, ${foot} foot`}
    >
      <defs>
        <clipPath id={clipId}>
          <path d={OUTLINE} />
        </clipPath>
      </defs>

      <g transform={foot === 'left' ? `translate(${VIEW_W} 0) scale(-1 1)` : undefined}>
        <path d={OUTLINE} fill="var(--surface-sunken)" />

        <g clipPath={`url(#${clipId})`}>
          <image
            href={href}
            x={GRID_BOX.x}
            y={GRID_BOX.y}
            width={GRID_BOX.width}
            height={GRID_BOX.height}
            preserveAspectRatio="none"
          />
          {/* The zone grid, always drawn — the rectangles are how the numbers below the
              foot and the numbers in the table are the same numbers. */}
          {recording.zones.map((zone) => {
            const b = zoneBox(zone, recording.rows, recording.cols);
            const active = hover?.zone === zone.zone;
            return (
              <rect
                key={zone.zone}
                x={b.x}
                y={b.y}
                width={b.width}
                height={b.height}
                fill="transparent"
                stroke={active ? 'var(--text-primary)' : 'var(--surface)'}
                strokeWidth={active ? 2.4 : 1.2}
                strokeOpacity={active ? 1 : 0.75}
                style={{ cursor: 'pointer' }}
                onMouseEnter={() => setHover(zone)}
                onMouseLeave={() => setHover(undefined)}
              >
                <title>{`${INSOLE_ZONE_LABEL[zone.zone]}: ${zoneValue(zone, statistic)} (${Math.round(zone.loadShare * 100)}% of load)`}</title>
              </rect>
            );
          })}
        </g>

        {/* Border last, over the heat, so the silhouette stays crisp against a hot edge. */}
        <path d={OUTLINE} fill="none" stroke="var(--border-strong)" strokeWidth={1.4} />
      </g>

      {recording.zones.map((zone) => {
        const b = zoneBox(zone, recording.rows, recording.cols);
        return (
          <ZoneLabel
            key={zone.zone}
            x={b.x + b.width / 2}
            y={b.y + b.height / 2}
            name={INSOLE_ZONE_SHORT[zone.zone]}
            value={`${Math.round(zoneValue(zone, statistic))}`}
            foot={foot}
          />
        );
      })}

      {/* Which edge is which, because that is the only thing telling the two feet apart. */}
      <text x={9} y={VIEW_H / 2} fontSize={7.5} fill="var(--text-muted)" textAnchor="middle" transform={`rotate(-90 9 ${VIEW_H / 2})`}>
        {edges.left.toUpperCase()}
      </text>
      <text
        x={VIEW_W - 8}
        y={VIEW_H / 2}
        fontSize={7.5}
        fill="var(--text-muted)"
        textAnchor="middle"
        transform={`rotate(90 ${VIEW_W - 8} ${VIEW_H / 2})`}
      >
        {edges.right.toUpperCase()}
      </text>
    </svg>
  );
}

/** The scale legend. One per pair of feet — the maps share a maximum on purpose. */
export function HeatScale({ max }: { max: number }): JSX.Element {
  const steps = 16;
  const stops = Array.from({ length: steps }, (_, i) => heatCss(i / (steps - 1))).join(', ');

  return (
    <div className="scale">
      <span>min pressure {HEAT_MIN}</span>
      <span
        className="scale-bar"
        style={{ background: `linear-gradient(to right, ${stops})` }}
        role="img"
        aria-label={`Pressure scale, ${HEAT_MIN} to ${Math.round(max)}`}
      />
      <span>{Math.round(max)} max pressure</span>
    </div>
  );
}
