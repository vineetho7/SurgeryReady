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
  /** Comorbidities that bear on the current episode. */
  condition: 'http://surgeryready.local/condition',
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

/** Whether the payer confirmed coverage. Mirrors EligibilityResult.status. */
export type CoverageStatus = 'active' | 'not-found' | 'inactive' | 'unchecked' | 'error';

/** Coverage a payer would not confirm blocks the case at the desk, so it is a barrier. */
export function coverageIsBarrier(status?: CoverageStatus): boolean {
  return status === 'not-found' || status === 'inactive';
}

/**
 * The only decision function in the system.
 *
 * Clinical review outranks everything: a reported fever beats a missing driver, always.
 * A model conducts the conversation; this decides the outcome.
 *
 * Coverage sits alongside the six spoken checks rather than inside them. A patient can
 * answer every question perfectly and still be sent home at the desk because nobody
 * verified their insurance, so it belongs in the same verdict — but it is a logistics
 * problem, never a clinical one, so it can raise a case to needs-attention and no higher.
 */
export function readiness(results: Partial<Record<CheckId, CheckResult>>, coverage?: CoverageStatus): Readiness {
  const answered = CHECKS.map((c) => results[c]);
  if (answered.includes('clinical')) {
    return 'clinical-review';
  }
  if (answered.includes('barrier') || coverageIsBarrier(coverage)) {
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
