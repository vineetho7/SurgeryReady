/**
 * Shared vocabulary between the seeder and this app.
 *
 * The app never decides a state. Pre-op readiness arrives as a meta tag on the
 * QuestionnaireResponse; post-op recovery arrives as DiagnosticReport.conclusionCode.
 * Everything here is parsing, not judgement.
 */

export const SYSTEM = {
  seed: 'http://surgeryready.local/seed-id',
  procedure: 'http://surgeryready.local/procedure',
  checkResult: 'http://surgeryready.local/check-result',
  readiness: 'http://surgeryready.local/readiness',
  barrier: 'http://surgeryready.local/barrier',
  measurement: 'http://surgeryready.local/measurement',
  zone: 'http://surgeryready.local/zone',
  recoveryState: 'http://surgeryready.local/recovery-state',
} as const;

export const CHECKS = ['arrival', 'npo', 'transport', 'medications', 'symptoms', 'teachback'] as const;
export type CheckId = (typeof CHECKS)[number];

export const CHECK_LABEL: Record<CheckId, string> = {
  arrival: 'Arrival time',
  npo: 'Nothing by mouth',
  transport: 'Transportation',
  medications: 'Medications',
  symptoms: 'New symptoms',
  teachback: 'Teach-back',
};

export type CheckResult = 'confirmed' | 'barrier' | 'clinical';
export type Readiness = 'ready' | 'needs-attention' | 'clinical-review' | 'unknown';
export type RecoveryState = 'on-track' | 'watch' | 'off-track' | 'insufficient-data';

export const READINESS_LABEL: Record<Readiness, string> = {
  ready: 'Ready',
  'needs-attention': 'Needs attention',
  'clinical-review': 'Clinical review',
  unknown: 'Not yet called',
};

export const RECOVERY_LABEL: Record<RecoveryState, string> = {
  'on-track': 'On track',
  watch: 'Watch',
  'off-track': 'Off track',
  'insufficient-data': 'Insufficient data',
};

/** Which status color a state maps to. Icon + label always accompany the color. */
export type Tone = 'good' | 'warning' | 'critical' | 'neutral';

export const READINESS_TONE: Record<Readiness, Tone> = {
  ready: 'good',
  'needs-attention': 'warning',
  'clinical-review': 'critical',
  unknown: 'neutral',
};

export const RECOVERY_TONE: Record<RecoveryState, Tone> = {
  'on-track': 'good',
  watch: 'warning',
  'off-track': 'critical',
  'insufficient-data': 'neutral',
};

export const ZONES = ['hallux', 'metatarsal1', 'metatarsal5', 'midfoot', 'heel'] as const;
export type Zone = (typeof ZONES)[number];

export const ZONE_LABEL: Record<Zone, string> = {
  hallux: 'Hallux',
  metatarsal1: '1st metatarsal',
  metatarsal5: '5th metatarsal',
  midfoot: 'Midfoot',
  heel: 'Heel',
};
