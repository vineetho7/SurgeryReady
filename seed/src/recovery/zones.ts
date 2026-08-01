/**
 * Plantar pressure analysis.
 *
 * The insole reports peak pressure at five zones per foot, plus how long each zone
 * spent outside its expected band. Recovery state is derived from those numbers by
 * the pure function at the bottom of this file — never by a model.
 *
 * CLINICAL VALUES BELOW ARE PLACEHOLDERS. The normative pressures and the
 * weight-bearing schedule are plausible defaults for demonstration, not validated
 * clinical thresholds. They are isolated here so a clinician can replace them
 * without touching the logic.
 */

export const ZONES = ['hallux', 'metatarsal1', 'metatarsal5', 'midfoot', 'heel'] as const;
export type Zone = (typeof ZONES)[number];

export const ZONE_LABEL: Record<Zone, string> = {
  hallux: 'Hallux',
  metatarsal1: '1st metatarsal',
  metatarsal5: '5th metatarsal',
  midfoot: 'Midfoot',
  heel: 'Heel',
};

/** Normative peak plantar pressure during walking, kPa. PLACEHOLDER — needs clinical review. */
export const NORMATIVE_PEAK_KPA: Record<Zone, number> = {
  hallux: 280,
  metatarsal1: 260,
  metatarsal5: 200,
  midfoot: 110,
  heel: 300,
};

/**
 * Expected loading as a fraction of normative, by post-operative day.
 *
 * Encodes a progressive weight-bearing protocol: protect the repair early, load it
 * deliberately later. Being *under* the band late is failure to progress; being
 * *over* it early is loading the repair before it can take it. Both are deviations.
 */
export interface LoadingStage {
  fromDay: number;
  toDay: number;
  min: number;
  max: number;
  label: string;
}

export const WEIGHT_BEARING_SCHEDULE: LoadingStage[] = [
  { fromDay: 0, toDay: 2, min: 0.1, max: 0.4, label: 'Protected' },
  { fromDay: 3, toDay: 7, min: 0.3, max: 0.6, label: 'Partial' },
  { fromDay: 8, toDay: 14, min: 0.5, max: 0.8, label: 'Progressive' },
  { fromDay: 15, toDay: 28, min: 0.7, max: 0.95, label: 'Advancing' },
  { fromDay: 29, toDay: 999, min: 0.85, max: 1.1, label: 'Full' },
];

export function stageForDay(postOpDay: number): LoadingStage {
  return (
    WEIGHT_BEARING_SCHEDULE.find((s) => postOpDay >= s.fromDay && postOpDay <= s.toDay) ??
    WEIGHT_BEARING_SCHEDULE[WEIGHT_BEARING_SCHEDULE.length - 1]
  );
}

/** Expected absolute pressure band for a zone on a given post-op day, in kPa. */
export function expectedBand(zone: Zone, postOpDay: number): { min: number; max: number } {
  const stage = stageForDay(postOpDay);
  const normative = NORMATIVE_PEAK_KPA[zone];
  return { min: normative * stage.min, max: normative * stage.max };
}

// ── Session data ──────────────────────────────────────────────────────

export interface ZoneReading {
  zone: Zone;
  /** Mean peak pressure across steps in the session, kPa. */
  peakKpa: number;
  /** Seconds of stance time this zone spent outside its expected band. */
  deviationSeconds: number;
}

export interface FootSession {
  /** Total stance time captured in the session, seconds. */
  stanceSeconds: number;
  readings: ZoneReading[];
}

export interface RecoverySession {
  postOpDay: number;
  operated: FootSession;
  contralateral: FootSession;
}

// ── Derived metrics ───────────────────────────────────────────────────

/** Fraction of stance time the operated foot spent outside band, averaged across zones. */
export function deviationFraction(foot: FootSession): number {
  if (foot.stanceSeconds <= 0) {
    return 0;
  }
  const total = foot.readings.reduce((sum, r) => sum + r.deviationSeconds, 0);
  return total / (foot.stanceSeconds * foot.readings.length);
}

/**
 * Load asymmetry between the operated foot and the sound side.
 *
 * 0 means the two feet carry equal load; 1 means one side carries everything.
 * This is the number that most directly answers "is she putting weight on it yet".
 */
export function asymmetryIndex(session: RecoverySession): number {
  const load = (f: FootSession): number => f.readings.reduce((sum, r) => sum + r.peakKpa, 0);
  const op = load(session.operated);
  const contra = load(session.contralateral);
  if (op + contra === 0) {
    return 0;
  }
  return Math.abs(contra - op) / (op + contra);
}

/**
 * The asymmetry you *should* see on a given post-op day.
 *
 * A patient two days out is supposed to be favouring the operated side — flagging that
 * would flag every normal recovery. Assuming total load is conserved across both feet,
 * an operated foot carrying fraction `o` of normative leaves the sound side with the
 * remainder, giving an expected asymmetry of `1 - o`. Deviation from the schedule is
 * the signal; raw asymmetry is not.
 */
export function expectedAsymmetry(postOpDay: number): number {
  const stage = stageForDay(postOpDay);
  const mid = (stage.min + stage.max) / 2;
  return Math.max(0, 1 - mid);
}

/** How far the patient sits above the asymmetry expected for their day. Negative is ahead of schedule. */
export function excessAsymmetry(session: RecoverySession): number {
  return asymmetryIndex(session) - expectedAsymmetry(session.postOpDay);
}

/** Zones loaded beyond what the protocol allows for this post-op day. */
export function overloadedZones(session: RecoverySession): Zone[] {
  return session.operated.readings
    .filter((r) => r.peakKpa > expectedBand(r.zone, session.postOpDay).max * OVERLOAD_TOLERANCE)
    .map((r) => r.zone);
}

/** Zones still below the protocol floor — failure to progress. */
export function underloadedZones(session: RecoverySession): Zone[] {
  return session.operated.readings
    .filter((r) => r.peakKpa < expectedBand(r.zone, session.postOpDay).min)
    .map((r) => r.zone);
}

// ── The decision ──────────────────────────────────────────────────────

export type RecoveryState = 'on-track' | 'watch' | 'off-track' | 'insufficient-data';

export const RECOVERY_DISPLAY: Record<RecoveryState, string> = {
  'on-track': 'On track',
  watch: 'Watch',
  'off-track': 'Off track',
  'insufficient-data': 'Insufficient data',
};

/** Tolerated headroom above the protocol ceiling before it counts as overloading. */
const OVERLOAD_TOLERANCE = 1.15;
/** Below this much stance time, the patient barely walked and the session says nothing. */
const MIN_STANCE_SECONDS = 300;

const DEVIATION_OFF_TRACK = 0.4;
const DEVIATION_WATCH = 0.2;
/** How far above the day's expected asymmetry counts as failing to progress. */
const EXCESS_ASYMMETRY_OFF_TRACK = 0.2;
const EXCESS_ASYMMETRY_WATCH = 0.1;

export interface RecoveryAssessment {
  state: RecoveryState;
  postOpDay: number;
  stage: string;
  deviationFraction: number;
  asymmetryIndex: number;
  overloaded: Zone[];
  underloaded: Zone[];
  /** Plain-language reasons, in precedence order. These are the report's bullet points. */
  reasons: string[];
}

/**
 * The only function that decides recovery state.
 *
 * Mirrors readiness() on the pre-op side: the voice agent conducts conversations,
 * the model writes prose, but the state comes from arithmetic on measurements.
 * Overloading a repair outranks everything else — it is the failure mode that
 * causes harm rather than merely delay.
 */
export function assess(session: RecoverySession, previous?: RecoveryAssessment): RecoveryAssessment {
  const stage = stageForDay(session.postOpDay);
  const deviation = deviationFraction(session.operated);
  const asymmetry = asymmetryIndex(session);
  const excess = excessAsymmetry(session);
  const overloaded = overloadedZones(session);
  const underloaded = underloadedZones(session);
  const reasons: string[] = [];

  const base = {
    postOpDay: session.postOpDay,
    stage: stage.label,
    deviationFraction: deviation,
    asymmetryIndex: asymmetry,
    overloaded,
    underloaded,
  };

  if (session.operated.stanceSeconds < MIN_STANCE_SECONDS) {
    reasons.push(
      `Only ${Math.round(session.operated.stanceSeconds / 60)} minutes of walking captured — too little to assess.`
    );
    return { ...base, state: 'insufficient-data', reasons };
  }

  if (overloaded.length > 0) {
    reasons.push(
      `Loading beyond the ${stage.label.toLowerCase()} weight-bearing limit at ${overloaded
        .map((z) => ZONE_LABEL[z].toLowerCase())
        .join(', ')}.`
    );
  }
  if (deviation > DEVIATION_OFF_TRACK) {
    reasons.push(`${Math.round(deviation * 100)}% of stance time outside the expected pressure band.`);
  }
  if (excess > EXCESS_ASYMMETRY_OFF_TRACK) {
    const worsening = previous ? asymmetry > previous.asymmetryIndex : false;
    reasons.push(
      `Load asymmetry ${Math.round(asymmetry * 100)}% against ${Math.round(expectedAsymmetry(session.postOpDay) * 100)}% expected for day ${session.postOpDay}${worsening ? ', worse than yesterday' : ''} — the operated side is not taking its share.`
    );
  }

  if (overloaded.length > 0 || deviation > DEVIATION_OFF_TRACK || excess > EXCESS_ASYMMETRY_OFF_TRACK) {
    return { ...base, state: 'off-track', reasons };
  }

  if (deviation > DEVIATION_WATCH) {
    reasons.push(`${Math.round(deviation * 100)}% of stance time outside band — drifting but not yet off track.`);
  }
  if (excess > EXCESS_ASYMMETRY_WATCH) {
    reasons.push(
      `Load asymmetry ${Math.round(asymmetry * 100)}%, ${Math.round(excess * 100)} points above what day ${session.postOpDay} expects.`
    );
  }
  if (underloaded.length > 0 && session.postOpDay >= 8) {
    reasons.push(
      `Still below the loading floor at ${underloaded.map((z) => ZONE_LABEL[z].toLowerCase()).join(', ')}.`
    );
  }

  if (reasons.length > 0) {
    return { ...base, state: 'watch', reasons };
  }

  reasons.push(`Loading within the ${stage.label.toLowerCase()} band across all five zones.`);
  if (previous && asymmetry < previous.asymmetryIndex) {
    reasons.push(
      `Asymmetry improved from ${Math.round(previous.asymmetryIndex * 100)}% to ${Math.round(asymmetry * 100)}%.`
    );
  }
  return { ...base, state: 'on-track', reasons };
}
