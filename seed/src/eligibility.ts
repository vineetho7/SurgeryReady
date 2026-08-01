/**
 * Insurance eligibility, via Stedi.
 *
 * Coverage that was never verified is a real cause of same-day cancellation — the case is
 * pulled at the desk, not in theatre. So eligibility is not a billing footnote here; it is
 * a readiness dimension sitting beside fasting and transport.
 *
 * Runs against Stedi test mode: mock payers, no PHI, no charges.
 */

const ENDPOINT = 'https://healthcare.us.stedi.com/2024-04-01/change/medicalnetwork/eligibility/v3';

/** Service type 30 — "Health Benefit Plan Coverage", the general eligibility question. */
const SERVICE_TYPE_GENERAL = '30';

export type CoverageStatus = 'active' | 'not-found' | 'inactive' | 'unchecked' | 'error';

export interface EligibilityResult {
  status: CoverageStatus;
  payerName?: string;
  planDetails?: string;
  /** Remaining in-network deductible in dollars, when the payer reports one. */
  deductibleRemaining?: number;
  outOfPocketRemaining?: number;
  copay?: number;
  coinsurancePercent?: number;
  /** Payer's own words when it cannot confirm coverage — worth showing verbatim. */
  problem?: string;
  checkedAt: string;
}

export interface EligibilityRequest {
  payerId: string;
  memberId: string;
  firstName: string;
  lastName: string;
}

/**
 * Stedi test mode recognises exactly one fixture member per payer — Aetna answers only to
 * member AETNA12345 named Jane Doe, and rejects any other name against that id with
 * "Invalid/Missing Subscriber/Insured Name".
 *
 * So a patient with active coverage is checked under the fixture identity. The HTTP call,
 * the parsing, and the benefit amounts are all real; the subscriber the payer matched is
 * the sandbox's, because no other subscriber exists in it. In production this is simply
 * the patient's own member id.
 */
export const TEST_MODE_SUBSCRIBER: EligibilityRequest = {
  payerId: '60054',
  memberId: 'AETNA12345',
  firstName: 'Jane',
  lastName: 'Doe',
};

interface BenefitInfo {
  code?: string;
  name?: string;
  benefitAmount?: string;
  benefitPercent?: string;
  inPlanNetworkIndicator?: string;
  timeQualifier?: string;
}

function amount(benefits: BenefitInfo[], name: string, period: string): number | undefined {
  const hit = benefits.find(
    (b) => b.name === name && b.inPlanNetworkIndicator === 'Yes' && b.timeQualifier === period && b.benefitAmount
  );
  return hit?.benefitAmount ? Number(hit.benefitAmount) : undefined;
}

export async function checkEligibility(request: EligibilityRequest): Promise<EligibilityResult> {
  const apiKey = process.env.STEDI_API_KEY;
  const checkedAt = new Date().toISOString();

  if (!apiKey) {
    return { status: 'unchecked', checkedAt };
  }

  let payload: Record<string, any>;
  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { Authorization: apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tradingPartnerServiceId: request.payerId,
        provider: { organizationName: 'SurgeryReady Clinic', npi: '1999999984' },
        subscriber: { firstName: request.firstName, lastName: request.lastName, memberId: request.memberId },
        encounter: { serviceTypeCodes: [SERVICE_TYPE_GENERAL] },
      }),
    });
    payload = (await response.json()) as Record<string, any>;
  } catch (err) {
    return { status: 'error', problem: (err as Error).message, checkedAt };
  }

  // A payer that cannot find the member answers with an AAA error rather than an HTTP
  // failure — the request succeeded, the answer is "no such member".
  const aaa = payload.subscriber?.aaaErrors ?? payload.errors ?? [];
  if (aaa.length > 0) {
    return {
      status: 'not-found',
      payerName: payload.payer?.name,
      problem: aaa[0]?.description ?? 'Payer could not confirm this member.',
      checkedAt,
    };
  }

  const planStatus = payload.planStatus ?? [];
  const active = planStatus.some((p: { statusCode?: string }) => p.statusCode === '1');
  if (!active) {
    return {
      status: 'inactive',
      payerName: payload.payer?.name,
      problem: planStatus[0]?.status ?? 'Coverage is not active.',
      checkedAt,
    };
  }

  const benefits: BenefitInfo[] = payload.benefitsInformation ?? [];
  const copay = benefits.find((b) => b.name === 'Co-Payment' && b.inPlanNetworkIndicator === 'Yes' && b.benefitAmount);
  const coinsurance = benefits.find(
    (b) => b.name === 'Co-Insurance' && b.inPlanNetworkIndicator === 'Yes' && Number(b.benefitPercent) > 0
  );

  return {
    status: 'active',
    payerName: payload.payer?.name,
    planDetails: planStatus.find((p: { planDetails?: string }) => p.planDetails)?.planDetails,
    deductibleRemaining: amount(benefits, 'Deductible', 'Remaining'),
    outOfPocketRemaining: amount(benefits, 'Out of Pocket (Stop Loss)', 'Remaining'),
    copay: copay?.benefitAmount ? Number(copay.benefitAmount) : undefined,
    coinsurancePercent: coinsurance?.benefitPercent ? Number(coinsurance.benefitPercent) * 100 : undefined,
    checkedAt,
  };
}

/** One line a coordinator can act on. */
export function eligibilitySummary(result: EligibilityResult): string {
  switch (result.status) {
    case 'active': {
      const parts = [`${result.payerName ?? 'Payer'} confirmed active coverage`];
      if (result.planDetails) {
        parts.push(`(${result.planDetails})`);
      }
      if (result.deductibleRemaining !== undefined) {
        parts.push(`— $${result.deductibleRemaining} deductible remaining`);
      }
      if (result.copay !== undefined) {
        parts.push(`, $${result.copay} copay`);
      }
      if (result.coinsurancePercent !== undefined) {
        parts.push(`, ${Math.round(result.coinsurancePercent)}% coinsurance`);
      }
      return parts.join(' ').replace(' ,', ',');
    }
    case 'not-found':
      return `Coverage could not be verified — ${result.problem ?? 'payer did not recognise this member'}. Confirm details before the case is pulled at the desk.`;
    case 'inactive':
      return `Coverage is not active — ${result.problem ?? 'payer reported inactive coverage'}.`;
    case 'error':
      return `Eligibility check failed: ${result.problem}`;
    default:
      return 'Eligibility not checked.';
  }
}
