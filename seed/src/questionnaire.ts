import type { Questionnaire } from '@medplum/fhirtypes';
import { SYSTEM } from './systems.js';

export const QUESTIONNAIRE_ID = 'preop-readiness-v1';

/**
 * Canonical URL. QuestionnaireResponse.questionnaire is a canonical in R4, not a
 * resource reference — so responses point here, never at a server-assigned id.
 */
export const QUESTIONNAIRE_URL = `http://surgeryready.local/Questionnaire/${QUESTIONNAIRE_ID}`;

/**
 * The six pre-op readiness checks, as data.
 *
 * Each check is a group holding two items:
 *   <check>.utterance — what the patient actually said, verbatim
 *   <check>.result    — how it graded
 *
 * Keeping the verbatim utterance is the point. A coordinator reviewing an exception
 * needs the patient's own words, not a model's paraphrase of them.
 */
export const PREOP_QUESTIONNAIRE: Questionnaire = {
  resourceType: 'Questionnaire',
  identifier: [{ system: SYSTEM.seed, value: QUESTIONNAIRE_ID }],
  url: QUESTIONNAIRE_URL,
  name: 'PreopReadiness',
  title: 'Pre-operative Readiness Check',
  status: 'active',
  subjectType: ['Patient'],
  description: 'Six checks confirmed by voice before a scheduled procedure, graded by teach-back.',
  item: [
    group('arrival', 'Arrival time', 'Do you know what time to arrive, and where?'),
    group('npo', 'Nothing by mouth', 'Tell me when you plan to stop eating and drinking.'),
    group('transport', 'Transportation', 'Who is driving you home afterwards?'),
    group('medications', 'Medications', 'Which of your medications have you been told to hold?'),
    group('symptoms', 'New symptoms', 'Any fever, cough, or feeling unwell since your last visit?'),
    group('teachback', 'Teach-back', 'In your own words, what are you doing to get ready tomorrow?'),
  ],
};

function group(linkId: string, text: string, prompt: string): NonNullable<Questionnaire['item']>[number] {
  return {
    linkId,
    text,
    type: 'group',
    item: [
      {
        linkId: `${linkId}.utterance`,
        text: prompt,
        type: 'string',
      },
      {
        linkId: `${linkId}.result`,
        text: `${text} — result`,
        type: 'choice',
        answerOption: [
          { valueCoding: { system: SYSTEM.checkResult, code: 'confirmed', display: 'Confirmed' } },
          { valueCoding: { system: SYSTEM.checkResult, code: 'barrier', display: 'Barrier' } },
          { valueCoding: { system: SYSTEM.checkResult, code: 'clinical', display: 'Clinical review' } },
        ],
      },
    ],
  };
}
