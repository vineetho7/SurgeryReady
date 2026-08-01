import type {
  Appointment,
  Coverage,
  CoverageEligibilityResponse,
  Patient,
  QuestionnaireResponse,
  QuestionnaireResponseItem,
  ServiceRequest,
  Task,
} from '@medplum/fhirtypes';
import { BOARD, type BoardCase } from './board.js';
import { login, seedId, upsert } from './client.js';
import { TEST_MODE_SUBSCRIBER, checkEligibility, eligibilitySummary, type EligibilityResult } from './eligibility.js';
import { PREOP_QUESTIONNAIRE, QUESTIONNAIRE_ID, QUESTIONNAIRE_URL } from './questionnaire.js';
import { CHECKS, READINESS_DISPLAY, SYSTEM, readiness, type CheckId, type CheckResult } from './systems.js';
import { seedRecovery } from './recovery/seed-recovery.js';

/** Tomorrow at the given local time. The whole board is one day out — that is the call window. */
function tomorrowAt(hour: number, minute: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(hour, minute, 0, 0);
  return d;
}

async function seedCase(kase: BoardCase): Promise<string> {
  const patient = await upsert<Patient>(
    {
      resourceType: 'Patient',
      identifier: seedId(kase.key),
      name: [{ given: [kase.given], family: kase.family }],
      birthDate: kase.birthDate,
      telecom: [{ system: 'phone', value: kase.phone, use: 'mobile' }],
      communication: kase.language
        ? [{ language: { coding: [{ system: 'urn:ietf:bcp:47', ...kase.language }] }, preferred: true }]
        : undefined,
    },
    kase.key
  );

  const start = tomorrowAt(kase.hour, kase.minute);
  const end = new Date(start.getTime() + 60 * 60 * 1000);

  const serviceRequest = await upsert<ServiceRequest>(
    {
      resourceType: 'ServiceRequest',
      identifier: seedId(`${kase.key}-sr`),
      status: 'active',
      intent: 'order',
      subject: { reference: `Patient/${patient.id}` },
      occurrenceDateTime: start.toISOString(),
      code: {
        coding: [{ system: SYSTEM.procedure, code: kase.procedure, display: kase.procedureDisplay }],
        text: kase.procedureDisplay,
      },
    },
    `${kase.key}-sr`
  );

  const appointment = await upsert<Appointment>(
    {
      resourceType: 'Appointment',
      identifier: seedId(`${kase.key}-appt`),
      status: 'booked',
      start: start.toISOString(),
      end: end.toISOString(),
      description: kase.procedureDisplay,
      basedOn: [{ reference: `ServiceRequest/${serviceRequest.id}` }],
      participant: [{ actor: { reference: `Patient/${patient.id}` }, status: 'accepted' }],
    },
    `${kase.key}-appt`
  );

  // Patients without an explicit plan are checked under the sandbox's fixture member, the
  // only subscriber it recognises. A case that carries its own plan is checked as itself —
  // and comes back unverifiable, which is the barrier we want to show.
  const plan = kase.coverage
    ? { ...kase.coverage, firstName: kase.given, lastName: kase.family }
    : TEST_MODE_SUBSCRIBER;
  const eligibility = await checkEligibility(plan);
  await seedCoverage(kase, `Patient/${patient.id}`, plan, eligibility);

  if (!kase.checks) {
    return `  ${label(kase)}  ${READINESS_DISPLAY.unknown}  ${coverageNote(eligibility)}`;
  }

  const results = Object.fromEntries(
    CHECKS.map((c) => [c, kase.checks?.[c].result])
  ) as Partial<Record<CheckId, CheckResult>>;
  const state = readiness(results, eligibility.status);

  const response = await upsert<QuestionnaireResponse>(
    {
      resourceType: 'QuestionnaireResponse',
      // R4 gives QuestionnaireResponse a single identifier, not a list.
      identifier: { system: SYSTEM.seed, value: `${kase.key}-qr` },
      // The derived state is stored, not recomputed downstream: readiness() is the only
      // place that decides, and the UI reads its verdict rather than repeating the rules.
      meta: { tag: [{ system: SYSTEM.readiness, code: state, display: READINESS_DISPLAY[state] }] },
      status: 'completed',
      questionnaire: QUESTIONNAIRE_URL,
      subject: { reference: `Patient/${patient.id}` },
      authored: new Date().toISOString(),
      item: CHECKS.map((check): QuestionnaireResponseItem => {
        const answer = kase.checks![check];
        return {
          linkId: check,
          item: [
            { linkId: `${check}.utterance`, answer: [{ valueString: answer.utterance }] },
            {
              linkId: `${check}.result`,
              answer: [{ valueCoding: { system: SYSTEM.checkResult, code: answer.result } }],
            },
          ],
        };
      }),
    },
    `${kase.key}-qr`
  );

  if (kase.barrier) {
    await upsert<Task>(
      {
        resourceType: 'Task',
        identifier: seedId(`${kase.key}-task`),
        status: 'requested',
        intent: 'order',
        priority: state === 'clinical-review' ? 'urgent' : 'routine',
        description: kase.barrier.summary,
        for: { reference: `Patient/${patient.id}` },
        focus: { reference: `QuestionnaireResponse/${response.id}` },
        authoredOn: new Date().toISOString(),
        code: {
          coding: [{ system: SYSTEM.barrier, code: kase.barrier.check }],
          text: `Pre-op barrier: ${kase.barrier.check}`,
        },
        restriction: { period: { end: appointment.start } },
      },
      `${kase.key}-task`
    );
  }

  return `  ${label(kase)}  ${READINESS_DISPLAY[state]}`;
}

/**
 * Persist the eligibility check as FHIR rather than as a note.
 *
 * Coverage records what is on file; CoverageEligibilityResponse records what the payer
 * actually said when asked, with the benefit amounts it returned. Both are real R4
 * resources, so the answer lives in the chart next to everything else.
 */
async function seedCoverage(
  kase: BoardCase,
  patientRef: string,
  plan: { payerId: string; memberId: string },
  result: EligibilityResult
): Promise<void> {
  const coverage = await upsert<Coverage>(
    {
      resourceType: 'Coverage',
      identifier: seedId(`${kase.key}-coverage`),
      status: result.status === 'active' ? 'active' : 'entered-in-error',
      beneficiary: { reference: patientRef },
      subscriberId: plan.memberId,
      payor: [{ display: result.payerName ?? `Payer ${plan.payerId}` }],
      class: result.planDetails ? [{ type: { text: 'plan' }, value: result.planDetails }] : undefined,
    },
    `${kase.key}-coverage`
  );

  const items = [];
  if (result.deductibleRemaining !== undefined) {
    items.push({ name: 'Deductible remaining', value: result.deductibleRemaining });
  }
  if (result.outOfPocketRemaining !== undefined) {
    items.push({ name: 'Out of pocket remaining', value: result.outOfPocketRemaining });
  }
  if (result.copay !== undefined) {
    items.push({ name: 'Copay', value: result.copay });
  }

  await upsert<CoverageEligibilityResponse>(
    {
      resourceType: 'CoverageEligibilityResponse',
      identifier: seedId(`${kase.key}-eligibility`),
      status: 'active',
      purpose: ['benefits'],
      patient: { reference: patientRef },
      created: result.checkedAt,
      request: { display: 'Stedi real-time eligibility (270/271), test mode' },
      // `outcome` is the payer's verdict; `disposition` is the sentence a human reads.
      outcome: result.status === 'active' ? 'complete' : 'error',
      disposition: eligibilitySummary(result),
      insurer: { display: result.payerName ?? `Payer ${plan.payerId}` },
      insurance: [
        {
          coverage: { reference: `Coverage/${coverage.id}` },
          inforce: result.status === 'active',
          item: items.map((item) => ({
            category: { text: item.name },
            benefit: [{ type: { text: item.name }, allowedMoney: { value: item.value, currency: 'USD' } }],
          })),
        },
      ],
    },
    `${kase.key}-eligibility`
  );
}

function coverageNote(result: EligibilityResult): string {
  switch (result.status) {
    case 'active':
      return `coverage ok${result.deductibleRemaining !== undefined ? ` ($${result.deductibleRemaining} ded.)` : ''}`;
    case 'unchecked':
      return 'coverage unchecked';
    default:
      return `COVERAGE ${result.status.toUpperCase()}`;
  }
}

function label(kase: BoardCase): string {
  const time = `${String(kase.hour).padStart(2, '0')}:${String(kase.minute).padStart(2, '0')}`;
  return `${time}  ${(kase.given + ' ' + kase.family).padEnd(20)} ${kase.procedureDisplay.padEnd(20)}`;
}

async function main(): Promise<void> {
  await login();
  console.log('Authenticated.\n');

  // No client-supplied id: the server assigns it, and responses reference the canonical url.
  await upsert(PREOP_QUESTIONNAIRE, QUESTIONNAIRE_ID);
  console.log(`Questionnaire seeded: ${PREOP_QUESTIONNAIRE.title}\n`);

  console.log("PRE-OP — tomorrow's board:");
  for (const kase of BOARD) {
    console.log(await seedCase(kase));
  }

  console.log('\nPOST-OP — recovery monitoring:');
  await seedRecovery();

  console.log('\nDone.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
