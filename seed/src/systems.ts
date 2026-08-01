/**
 * Local code systems and identifier namespaces for SurgeryReady.
 *
 * Deliberately local rather than SNOMED/LOINC: fabricated clinical codes are worse
 * than honestly-scoped local ones. Swap in verified terminology before any real use.
 */

export const SYSTEM = {
  /** Identifier namespace for every resource this seed creates, so re-runs are idempotent. */
  seed: 'http://surgeryready.local/seed-id',
  /** Procedures on the surgery board. TODO: map to verified SNOMED CT before real use. */
  procedure: 'http://surgeryready.local/procedure',
  /** Outcome of a single readiness check. */
  checkResult: 'http://surgeryready.local/check-result',
  /** Derived readiness state for a whole call. */
  readiness: 'http://surgeryready.local/readiness',
  /** Which check a Task was raised from. */
  barrier: 'http://surgeryready.local/barrier',
  /** Observation and report codes for insole monitoring. */
  measurement: 'http://surgeryready.local/measurement',
  /** Per-zone, per-foot component codes on a session Observation. */
  zone: 'http://surgeryready.local/zone',
  /** Derived post-operative recovery state. */
  recoveryState: 'http://surgeryready.local/recovery-state',
} as const;

/** The six things the agent confirms on every pre-op call, in the order it asks them. */
export const CHECKS = ['arrival', 'npo', 'transport', 'medications', 'symptoms', 'teachback'] as const;

export type CheckId = (typeof CHECKS)[number];

/**
 * Per-check outcome.
 * - confirmed: patient demonstrated understanding
 * - barrier:   a logistical problem a coordinator can fix
 * - clinical:  patient said something needing human clinical judgement
 */
export type CheckResult = 'confirmed' | 'barrier' | 'clinical';

/** Derived state for the whole call. Never produced by the model — see readiness(). */
export type Readiness = 'ready' | 'needs-attention' | 'clinical-review' | 'unknown';

/**
 * The only decision function in the system.
 *
 * Clinical review outranks everything: a reported fever beats a missing driver, always.
 * A model conducts the conversation; this decides the outcome.
 */
export function readiness(results: Partial<Record<CheckId, CheckResult>>): Readiness {
  const answered = CHECKS.map((c) => results[c]);
  if (answered.includes('clinical')) {
    return 'clinical-review';
  }
  if (answered.includes('barrier')) {
    return 'needs-attention';
  }
  if (answered.every((r) => r === 'confirmed')) {
    return 'ready';
  }
  return 'unknown';
}

export const READINESS_DISPLAY: Record<Readiness, string> = {
  ready: 'Ready',
  'needs-attention': 'Needs attention',
  'clinical-review': 'Clinical review',
  unknown: 'Not yet called',
};
