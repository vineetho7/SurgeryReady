/**
 * Raw insole recordings, as reduced by InsoleDataRecord/insole_to_webapp.py.
 *
 * The sensor grid the insole actually produced: 16 x 8 cells per foot, averaged and
 * peaked over the contact frames of a session. Medplum's `plantar-pressure-report-24h`
 * carries the same zones but only their peaks, so the mean map and the cell-level
 * detail exist here and nowhere else.
 *
 * Nothing here writes to Medplum, and nothing here judges. It loads static JSON.
 */

import { useEffect, useState } from 'react';
import { ZONE_LABEL, type Zone } from './model';

/** The app's five FHIR zones plus the lesser toes, which the sensor grid resolves. */
export type InsoleZoneId = Zone | 'lesserToes';

export const INSOLE_ZONE_LABEL: Record<InsoleZoneId, string> = {
  ...ZONE_LABEL,
  lesserToes: 'Lesser toes',
};

/** For the labels drawn on the foot, where a zone is only as wide as a few sensors. */
export const INSOLE_ZONE_SHORT: Record<InsoleZoneId, string> = {
  hallux: 'Hallux',
  lesserToes: 'Toes',
  metatarsal1: 'MT1',
  metatarsal5: 'MT5',
  midfoot: 'Midfoot',
  heel: 'Heel',
};

export interface InsoleZone {
  zone: InsoleZoneId;
  /** Grid rows [start, end) the zone covers — row 0 is the toe. */
  rows: [number, number];
  /** Grid columns [start, end) — column 0 is medial, on both sides. */
  cols: [number, number];
  mean: number;
  peak: number;
  /** This zone's share of the foot's total mean load, 0–1. */
  loadShare: number;
}

export interface InsoleRecording {
  source: string;
  side: 'LEFT' | 'RIGHT';
  rows: number;
  cols: number;
  /** Oriented grids, [row][col]; row 0 = toe, col 0 = medial. */
  mean: number[][];
  peak: number[][];
  zones: InsoleZone[];
  frames: { total: number; contact: number; durationSeconds: number; stanceSeconds: number };
  grf: { mean: number; peak: number };
}

export type Statistic = 'mean' | 'peak';

export function gridFor(recording: InsoleRecording, statistic: Statistic): number[][] {
  return statistic === 'mean' ? recording.mean : recording.peak;
}

export function zoneValue(zone: InsoleZone, statistic: Statistic): number {
  return statistic === 'mean' ? zone.mean : zone.peak;
}

/**
 * The hottest cell in a set of recordings, for one statistic.
 *
 * The color scale is built from this rather than from a fixed ceiling: mean pressure
 * over a session tops out far below peak pressure, and a scale sized for peaks paints
 * every mean map the same pale wash.
 */
export function scaleMaxOf(recordings: InsoleRecording[], statistic: Statistic): number {
  const max = Math.max(...recordings.flatMap((r) => gridFor(r, statistic).flat()));
  return max > 0 ? max : 1;
}

/**
 * Left/right difference as a percentage of the pair.
 *
 * Positive means the *first* argument carries more. Reported on stance time and on
 * mean ground reaction force separately: a foot can be spared in duration, in force,
 * or in both, and which one it is says something different about the gait.
 */
export function asymmetry(a: number, b: number): number {
  const total = a + b;
  return total === 0 ? 0 : ((a - b) / total) * 100;
}

// ── Color ramp ────────────────────────────────────────────────────────
//
// The blue→red ramp the StrideTrack live view and insole_zone_map.py both use: hue
// swept 220°→0° at fixed saturation, lightness easing down across the sweep. It is a
// multi-hue ramp for a magnitude, which normally reads as a rainbow — legible here
// only because it is the established convention for plantar pressure and because a
// scale legend always accompanies it. Same colors in light and dark, so a map printed
// or exported next to the Python one is the same picture.
//
// The floor matches the tools too: 25 raw units, below which a cell is noise.

export const HEAT_MIN = 25;

function hslToRgb(hue: number, saturation: number, lightness: number): [number, number, number] {
  const c = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const h = hue * 6;
  const x = c * (1 - Math.abs((h % 2) - 1));
  const m = lightness - c / 2;
  const [r, g, b] =
    h < 1 ? [c, x, 0] : h < 2 ? [x, c, 0] : h < 3 ? [0, c, x] : h < 4 ? [0, x, c] : h < 5 ? [x, 0, c] : [c, 0, x];
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

/** Ramp color at position `t` (0–1). */
export function heatRgb(t: number): [number, number, number] {
  const ratio = Math.min(1, Math.max(0, t));
  return hslToRgb((220 - ratio * 220) / 360, 0.88, (58 - ratio * 10) / 100);
}

export function heatCss(t: number): string {
  const [r, g, b] = heatRgb(t);
  return `rgb(${r} ${g} ${b})`;
}

/** Where a raw value sits on the ramp, given the scale ceiling. */
export function heatPosition(value: number, scaleMax: number): number {
  return (value - HEAT_MIN) / Math.max(1e-6, scaleMax - HEAT_MIN);
}

// ── Loading ───────────────────────────────────────────────────────────

/** Recordings are static JSON under public/insole, keyed by CSV stem. */
export async function loadRecording(name: string): Promise<InsoleRecording> {
  const response = await fetch(`${import.meta.env.BASE_URL}insole/${name}.json`);
  if (!response.ok) {
    throw new Error(
      `${name}.json not found (${response.status}). Generate it with: ` +
        `python3 InsoleDataRecord/insole_to_webapp.py data/${name}.csv`
    );
  }
  return (await response.json()) as InsoleRecording;
}

export function useRecordings(names: string[]): {
  recordings?: InsoleRecording[];
  loading: boolean;
  error?: Error;
} {
  const [recordings, setRecordings] = useState<InsoleRecording[]>();
  const [error, setError] = useState<Error>();
  const [loading, setLoading] = useState(true);
  const key = names.join(',');

  useEffect(() => {
    let live = true;
    setLoading(true);
    Promise.all(key.split(',').map(loadRecording))
      .then((result) => live && setRecordings(result))
      .catch((err) => live && setError(err as Error))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [key]);

  return { recordings, loading, error };
}
