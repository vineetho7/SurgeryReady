import type { Coverage, CoverageEligibilityResponse } from '@medplum/fhirtypes';
import { seedId, upsert } from './client.js';
import { eligibilitySummary, type EligibilityResult } from './eligibility.js';

/**
 * Persist the eligibility check as FHIR rather than as a note.
 *
 * Coverage records what is on file; CoverageEligibilityResponse records what the payer
 * actually said when asked, with the benefit amounts it returned. Both are real R4
 * resources, so the answer lives in the chart next to everything else.
 */
export async function seedCoverage(
  key: string,
  patientRef: string,
  plan: { payerId: string; memberId: string },
  result: EligibilityResult
): Promise<void> {
  const coverage = await upsert<Coverage>(
    {
      resourceType: 'Coverage',
      identifier: seedId(`${key}-coverage`),
      status: result.status === 'active' ? 'active' : 'entered-in-error',
      beneficiary: { reference: patientRef },
      subscriberId: plan.memberId,
      payor: [{ display: result.payerName ?? `Payer ${plan.payerId}` }],
      class: result.planDetails ? [{ type: { text: 'plan' }, value: result.planDetails }] : undefined,
    },
    `${key}-coverage`
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
      identifier: seedId(`${key}-eligibility`),
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
    `${key}-eligibility`
  );
}
