/**
 * Sanity check on the seeded project. Run after seeding, and again before the demo.
 *
 * Counts are exact, not lower bounds: if Patient exceeds the roster, a seed run created
 * duplicates and the board will show the same person twice on stage.
 */
import type { ResourceType } from '@medplum/fhirtypes';
import { BOARD } from './board.js';
import { login, medplum } from './client.js';
import { conditionCount } from './history.js';
import { COHORT, historyDays } from './recovery/cohort.js';
import { SYSTEM } from './systems.js';

const sessions = COHORT.reduce((total, patient) => total + historyDays(patient).length, 0);

interface Check {
  type: ResourceType;
  query: string;
  expected: number;
  label: string;
}

const CHECKS: Check[] = [
  { type: 'Patient', query: '', expected: BOARD.length + COHORT.length, label: 'Patient' },
  { type: 'Appointment', query: '', expected: BOARD.length, label: 'Appointment' },
  { type: 'ServiceRequest', query: '', expected: BOARD.length, label: 'ServiceRequest' },
  { type: 'QuestionnaireResponse', query: '', expected: BOARD.filter((c) => c.checks).length, label: 'QuestionnaireResponse' },
  { type: 'Questionnaire', query: '', expected: 1, label: 'Questionnaire' },
  { type: 'Condition', query: '', expected: conditionCount(), label: 'Condition (relevant hx)' },
  // Coverage is checked for everyone now, pre-op and recovery alike.
  { type: 'Coverage', query: '', expected: BOARD.length + COHORT.length, label: 'Coverage' },
  {
    type: 'CoverageEligibilityResponse',
    query: '',
    expected: BOARD.length + COHORT.length,
    label: 'CoverageEligibilityResponse',
  },
  { type: 'Device', query: '', expected: COHORT.length, label: 'Device (insoles)' },
  { type: 'Procedure', query: '', expected: COHORT.length, label: 'Procedure' },
  { type: 'Observation', query: '', expected: sessions, label: 'Observation (sessions)' },
  { type: 'DiagnosticReport', query: '', expected: sessions, label: 'DiagnosticReport' },
  // Only open tasks: resolved recovery escalations are closed, not deleted.
  {
    type: 'Task',
    query: '&status=requested',
    expected: BOARD.filter((c) => c.barrier).length + COHORT.filter((c) => c.trajectory === 'overloading').length,
    label: 'Task (open)',
  },
];

async function main(): Promise<void> {
  await login();

  let ok = true;
  for (const check of CHECKS) {
    const bundle = await medplum.search(
      check.type,
      `_summary=count&identifier=${encodeURIComponent(`${SYSTEM.seed}|`)}${check.query}`
    );
    const actual = bundle.total ?? 0;
    const pass = actual === check.expected;
    ok &&= pass;
    console.log(`${pass ? 'ok  ' : 'FAIL'} ${check.label.padEnd(24)} ${actual} (expected ${check.expected})`);
  }

  if (!ok) {
    console.error('\nCounts are off. Duplicates usually mean an identifier changed between seed runs.');
    process.exit(1);
  }
  console.log('\nBoard is intact.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
