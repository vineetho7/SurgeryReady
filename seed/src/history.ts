import type { Condition } from '@medplum/fhirtypes';
import { seedId, upsert } from './client.js';
import { SYSTEM } from './systems.js';

/**
 * Relevant history — deliberately not "medical history".
 *
 * Only conditions that change how the current episode should be read belong here. A
 * general chart dump would turn a narrow perioperative tool into a chatbot over the
 * record, and give the agent a great deal more to be wrong about. The test for including
 * something is simple: does it change what this patient's verdict means?
 *
 * Rosa is loading a Lisfranc fixation too early. That is off-protocol for anyone; in a
 * diabetic smoker whose bone is already healing slowly, it is the difference between a
 * delay and a failed fixation. The number does not say that. This does.
 *
 * Codes use a local system rather than invented SNOMED or ICD-10 — see the note in
 * systems.ts. The display text is what a clinician reads.
 */

export interface RelevantCondition {
  code: string;
  display: string;
  /** Why it matters for *this* episode. Shown next to the verdict, spoken by the agent. */
  bearing: string;
  onsetYear?: number;
}

export const HISTORY: Record<string, RelevantCondition[]> = {
  // ── Recovery cohort ──
  'rosa-iqbal': [
    {
      code: 'type-2-diabetes',
      display: 'Type 2 diabetes mellitus',
      bearing: 'Impairs bone healing. Early loading of a fixation carries more risk of failure than it would otherwise.',
      onsetYear: 2019,
    },
    {
      code: 'current-smoker',
      display: 'Current smoker',
      bearing: 'Nicotine lowers bone union rates after fixation, compounding the effect of loading too soon.',
    },
  ],
  'marcus-bell': [
    {
      code: 'prior-ankle-fracture',
      display: 'Previous fracture, same ankle',
      bearing: 'Guarding is common after a repeat injury. Under-loading may be pain or fear rather than a mechanical problem.',
      onsetYear: 2021,
    },
  ],
  'ana-delgado': [
    {
      code: 'hallux-valgus-bilateral',
      display: 'Bilateral hallux valgus',
      bearing: 'The unoperated side is also deformed, so contralateral load is not a clean healthy baseline.',
    },
  ],

  // ── Pre-op board ──
  'edward-nakamura': [
    {
      code: 'copd',
      display: 'COPD',
      bearing: 'Raises anaesthetic risk. A new productive cough is an automatic stop rather than a judgement call.',
      onsetYear: 2016,
    },
  ],
  'harold-vance': [
    {
      code: 'atrial-fibrillation',
      display: 'Atrial fibrillation',
      bearing: 'On long-term anticoagulation. The medication hold is the check that matters most for this patient.',
      onsetYear: 2018,
    },
  ],
  'maria-santos': [
    {
      code: 'iron-deficiency-anaemia',
      display: 'Iron deficiency anaemia',
      bearing: 'The indication for this colonoscopy. Completing the prep matters more than usual — a repeat delays the diagnosis.',
      onsetYear: 2026,
    },
  ],
};

/** Total across the roster, so verify() can assert an exact count. */
export function conditionCount(): number {
  return Object.values(HISTORY).reduce((total, list) => total + list.length, 0);
}

export async function seedConditions(key: string, patientRef: string): Promise<void> {
  const conditions = HISTORY[key] ?? [];
  for (const [index, condition] of conditions.entries()) {
    await upsert<Condition>(
      {
        resourceType: 'Condition',
        identifier: seedId(`${key}-condition-${index}`),
        clinicalStatus: {
          coding: [
            { system: 'http://terminology.hl7.org/CodeSystem/condition-clinical', code: 'active', display: 'Active' },
          ],
        },
        category: [
          {
            coding: [
              {
                system: 'http://terminology.hl7.org/CodeSystem/condition-category',
                code: 'problem-list-item',
                display: 'Problem List Item',
              },
            ],
          },
        ],
        code: {
          coding: [{ system: SYSTEM.condition, code: condition.code, display: condition.display }],
          text: condition.display,
        },
        subject: { reference: patientRef },
        onsetDateTime: condition.onsetYear ? `${condition.onsetYear}-01-01` : undefined,
        // The bearing travels with the condition so the UI and the agent read the same
        // sentence, and neither has to work out relevance for itself.
        note: [{ text: condition.bearing }],
      },
      `${key}-condition-${index}`
    );
  }
}
