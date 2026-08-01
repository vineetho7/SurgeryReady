import {
  NORMATIVE_PEAK_KPA,
  ZONES,
  stageForDay,
  type FootSession,
  type RecoverySession,
  type Zone,
} from './zones.js';

/**
 * The post-op cohort and their insole data.
 *
 * Sessions are generated rather than recorded, but generated deterministically —
 * a fixed seed per patient means a re-run produces byte-identical numbers, so the
 * demo shows the same trajectory every time and re-seeding never shifts the story.
 */

export type Trajectory = 'recovering' | 'stalling' | 'overloading' | 'late-recovery';

export interface CohortPatient {
  key: string;
  given: string;
  family: string;
  birthDate: string;
  phone: string;
  procedure: string;
  procedureDisplay: string;
  side: 'left' | 'right';
  /** Days since surgery as of today. */
  postOpDay: number;
  trajectory: Trajectory;
  serial: string;
}

export const COHORT: CohortPatient[] = [
  {
    key: 'ana-delgado',
    given: 'Ana',
    family: 'Delgado',
    birthDate: '1970-03-22',
    phone: '+1-415-555-0201',
    procedure: 'hallux-valgus-correction',
    procedureDisplay: 'Hallux valgus correction',
    side: 'right',
    postOpDay: 12,
    trajectory: 'recovering',
    serial: 'INS-4471-A',
  },
  {
    key: 'marcus-bell',
    given: 'Marcus',
    family: 'Bell',
    birthDate: '1984-11-09',
    phone: '+1-415-555-0214',
    procedure: 'ankle-orif',
    procedureDisplay: 'Ankle ORIF',
    side: 'left',
    postOpDay: 6,
    trajectory: 'stalling',
    serial: 'INS-4471-B',
  },
  {
    key: 'rosa-iqbal',
    given: 'Rosa',
    family: 'Iqbal',
    birthDate: '1992-07-04',
    phone: '+1-415-555-0228',
    procedure: 'lisfranc-fixation',
    procedureDisplay: 'Lisfranc fixation',
    side: 'right',
    postOpDay: 4,
    trajectory: 'overloading',
    serial: 'INS-4471-C',
  },
];

/** How many days of history to generate per patient. */
export const HISTORY_DAYS = 6;

// ── Deterministic noise ───────────────────────────────────────────────

/** Small LCG. Same seed, same sequence, forever — no Math.random anywhere. */
function rng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function seedFor(key: string, day: number): number {
  let h = 2166136261;
  for (const ch of `${key}:${day}`) {
    h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  }
  return h >>> 0;
}

// ── Trajectory shapes ─────────────────────────────────────────────────

/**
 * Target loading as a fraction of normative for a given trajectory and day.
 * The band for that day comes from the weight-bearing schedule; these curves say
 * where in (or outside) the band the patient actually sits.
 */
function targetLoad(trajectory: Trajectory, day: number): number {
  const band = stageForDay(day);
  const mid = (band.min + band.max) / 2;
  switch (trajectory) {
    case 'recovering':
      return mid;
    case 'late-recovery':
      return mid + (band.max - mid) * 0.5;
    case 'stalling':
      // Sits at the floor and stops climbing — the patient is guarding the foot.
      return band.min * 0.92;
    case 'overloading':
      // Walking on it well beyond what the repair can take this early.
      return band.max * 1.45;
  }
}

/** Contralateral load: the sound foot compensates for whatever the operated side is not doing. */
function contralateralLoad(operated: number): number {
  return Math.min(1.6, 1.0 + Math.max(0, 0.85 - operated) * 0.9);
}

/** Minutes walked per day — rises as recovery progresses, collapses if the foot hurts. */
function stanceSeconds(trajectory: Trajectory, day: number, r: () => number): number {
  const ramp = Math.min(1, 0.25 + day * 0.06);
  const base = trajectory === 'stalling' ? 900 : 2400;
  return Math.round(base * ramp * (0.85 + r() * 0.3));
}

/**
 * Zones carry load unevenly: forefoot procedures spare the toes, hindfoot spares the heel.
 *
 * Kept mild on purpose. This models load *redistribution* within an otherwise
 * on-schedule foot — push it harder and the surgical site drops under the protocol
 * floor, which the analysis would correctly read as failure to progress rather than
 * as normal offloading.
 */
function zoneBias(zone: Zone, procedure: string): number {
  const forefoot = procedure === 'hallux-valgus-correction' || procedure === 'lisfranc-fixation';
  if (forefoot) {
    return zone === 'hallux' ? 0.86 : zone === 'metatarsal1' ? 0.9 : zone === 'heel' ? 1.1 : 1.0;
  }
  return zone === 'heel' ? 0.9 : zone === 'midfoot' ? 0.95 : 1.06;
}

function buildFoot(
  loadFraction: number,
  procedure: string,
  seconds: number,
  deviationRatio: number,
  r: () => number
): FootSession {
  return {
    stanceSeconds: seconds,
    readings: ZONES.map((zone) => {
      const jitter = 0.94 + r() * 0.12;
      return {
        zone,
        peakKpa: Math.round(NORMATIVE_PEAK_KPA[zone] * loadFraction * zoneBias(zone, procedure) * jitter),
        deviationSeconds: Math.round(seconds * deviationRatio * (0.8 + r() * 0.4)),
      };
    }),
  };
}

/** Share of stance time spent outside the band, by trajectory. */
function deviationRatio(trajectory: Trajectory, day: number): number {
  switch (trajectory) {
    case 'recovering':
      return Math.max(0.04, 0.3 - day * 0.02);
    case 'late-recovery':
      return 0.05;
    case 'stalling':
      return 0.26;
    case 'overloading':
      return 0.52;
  }
}

/** One day's session for one patient. */
export function sessionFor(patient: CohortPatient, postOpDay: number): RecoverySession {
  const r = rng(seedFor(patient.key, postOpDay));
  const operatedLoad = targetLoad(patient.trajectory, postOpDay);
  const seconds = stanceSeconds(patient.trajectory, postOpDay, r);
  return {
    postOpDay,
    operated: buildFoot(operatedLoad, patient.procedure, seconds, deviationRatio(patient.trajectory, postOpDay), r),
    contralateral: buildFoot(contralateralLoad(operatedLoad), patient.procedure, seconds, 0.02, r),
  };
}

/** The window of days to generate for a patient, oldest first. */
export function historyDays(patient: CohortPatient): number[] {
  const first = Math.max(0, patient.postOpDay - HISTORY_DAYS + 1);
  const days: number[] = [];
  for (let d = first; d <= patient.postOpDay; d++) {
    days.push(d);
  }
  return days;
}
