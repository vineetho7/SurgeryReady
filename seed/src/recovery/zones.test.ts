import { describe, expect, it } from 'vitest';
import {
  NORMATIVE_PEAK_KPA,
  ZONES,
  assess,
  asymmetryIndex,
  expectedBand,
  stageForDay,
  type FootSession,
  type RecoverySession,
  type Zone,
} from './zones.js';

/** A foot loaded at `fraction` of normative across every zone, with no time out of band. */
function foot(fraction: number, opts: { deviationSeconds?: number; stanceSeconds?: number } = {}): FootSession {
  const stanceSeconds = opts.stanceSeconds ?? 1800;
  return {
    stanceSeconds,
    readings: ZONES.map((zone: Zone) => ({
      zone,
      peakKpa: NORMATIVE_PEAK_KPA[zone] * fraction,
      deviationSeconds: opts.deviationSeconds ?? 0,
    })),
  };
}

function session(postOpDay: number, operated: FootSession, contralateral = foot(1.0)): RecoverySession {
  return { postOpDay, operated, contralateral };
}

describe('weight-bearing schedule', () => {
  it('advances through stages with post-op day', () => {
    expect(stageForDay(0).label).toBe('Protected');
    expect(stageForDay(5).label).toBe('Partial');
    expect(stageForDay(10).label).toBe('Progressive');
    expect(stageForDay(20).label).toBe('Advancing');
    expect(stageForDay(60).label).toBe('Full');
  });

  it('never falls off the end of the schedule', () => {
    expect(stageForDay(100000).label).toBe('Full');
  });

  it('widens the expected band as recovery progresses', () => {
    expect(expectedBand('heel', 1).max).toBeLessThan(expectedBand('heel', 30).max);
  });
});

describe('asymmetryIndex', () => {
  it('is zero when both feet carry equal load', () => {
    expect(asymmetryIndex(session(30, foot(1.0), foot(1.0)))).toBe(0);
  });

  it('rises as the operated side takes less', () => {
    const mild = asymmetryIndex(session(10, foot(0.8), foot(1.0)));
    const severe = asymmetryIndex(session(10, foot(0.3), foot(1.0)));
    expect(severe).toBeGreaterThan(mild);
  });

  it('does not divide by zero when nothing is loaded', () => {
    expect(asymmetryIndex(session(1, foot(0), foot(0)))).toBe(0);
  });
});

describe('assess', () => {
  it('reports insufficient data when the patient barely walked', () => {
    const result = assess(session(10, foot(0.65, { stanceSeconds: 120 })));
    expect(result.state).toBe('insufficient-data');
  });

  it('is on track when loading sits inside the band for the day', () => {
    // POD 10 expects 0.5–0.8 of normative. 0.65 is mid-band on both feet.
    const result = assess(session(10, foot(0.65), foot(0.65)));
    expect(result.state).toBe('on-track');
  });

  it('is off track when the repair is loaded past the protocol ceiling', () => {
    // POD 1 allows at most 0.4; walking at full load is the harmful failure.
    const result = assess(session(1, foot(1.0), foot(1.0)));
    expect(result.state).toBe('off-track');
    expect(result.overloaded.length).toBeGreaterThan(0);
  });

  it('ranks overloading above every other signal', () => {
    // Perfect symmetry and no time out of band, but loaded too early.
    const result = assess(session(1, foot(1.0), foot(1.0)));
    expect(result.state).toBe('off-track');
    expect(result.reasons[0]).toMatch(/weight-bearing limit/);
  });

  it('is off track when the operated side is not taking its share', () => {
    const result = assess(session(20, foot(0.72), foot(1.6)));
    expect(result.state).toBe('off-track');
    expect(result.asymmetryIndex).toBeGreaterThan(0.25);
  });

  it('is off track when most of stance time falls outside the band', () => {
    const result = assess(session(10, foot(0.65, { deviationSeconds: 900 }), foot(0.65)));
    expect(result.deviationFraction).toBeGreaterThan(0.4);
    expect(result.state).toBe('off-track');
  });

  it('flags watch for drift that is not yet failure', () => {
    const result = assess(session(10, foot(0.65, { deviationSeconds: 450 }), foot(0.65)));
    expect(result.state).toBe('watch');
  });

  it('notes when asymmetry is worsening against the previous day', () => {
    const yesterday = assess(session(19, foot(0.75), foot(1.4)));
    const today = assess(session(20, foot(0.72), foot(1.6)), yesterday);
    expect(today.reasons.join(' ')).toMatch(/worse than yesterday/);
  });

  it('credits improvement when asymmetry is closing', () => {
    const yesterday = assess(session(9, foot(0.55), foot(0.7)));
    const today = assess(session(10, foot(0.65), foot(0.65)), yesterday);
    expect(today.state).toBe('on-track');
    expect(today.reasons.join(' ')).toMatch(/improved/);
  });

  it('always produces at least one reason, whatever the state', () => {
    for (const day of [0, 3, 10, 20, 40]) {
      for (const load of [0.1, 0.5, 0.9, 1.3]) {
        expect(assess(session(day, foot(load))).reasons.length).toBeGreaterThan(0);
      }
    }
  });
});
