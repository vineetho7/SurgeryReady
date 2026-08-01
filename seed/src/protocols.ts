import type { CheckId } from './systems.js';

/**
 * The prep-protocol corpus. This is what gets loaded into Moss before a call.
 *
 * `text` is what retrieval matches against — written the way patients describe things,
 * not the way charts do, because the query at runtime is a patient utterance.
 *
 * `approvedWording` is the ONLY thing the agent is allowed to say back on a mismatch.
 * The model does not compose clinical instructions; it reads these out. That constraint
 * is what keeps the agent out of giving medical advice.
 */
export interface ProtocolRule {
  id: string;
  procedure: string;
  check: CheckId;
  text: string;
  approvedWording: string;
  /** Grading hint: does violating this rule block the case, or just need a coordinator? */
  onViolation: 'barrier' | 'clinical';
}

export const PROTOCOLS: ProtocolRule[] = [
  // ── Colonoscopy ──────────────────────────────────────────────────────
  {
    id: 'colonoscopy-npo-clear-liquids',
    procedure: 'colonoscopy',
    check: 'npo',
    text: 'Clear liquids only the day before. Nothing at all after midnight. Coffee, tea, milk, cream, creamer, dairy, juice with pulp, smoothies, soup, and anything you cannot see through are not clear liquids. Black coffee is still not allowed on the morning of the procedure.',
    approvedWording:
      'Clear liquids only the day before, and nothing at all — not even water or coffee — after midnight. Anything with milk or cream in it does not count as a clear liquid.',
    onViolation: 'barrier',
  },
  {
    id: 'colonoscopy-prep-solution',
    procedure: 'colonoscopy',
    check: 'npo',
    text: 'The bowel prep solution must be finished on the schedule the clinic gave you. Split-dose prep means half in the evening and half early the next morning. Not finishing the prep is the most common reason a colonoscopy is cancelled on the day.',
    approvedWording:
      'You need to finish the whole bowel prep on the schedule the clinic gave you, including the early-morning half.',
    onViolation: 'barrier',
  },
  {
    id: 'colonoscopy-transport-sedation',
    procedure: 'colonoscopy',
    check: 'transport',
    text: 'Sedation is used, so a responsible adult must drive you home and stay with you. You cannot drive yourself, take a taxi alone, or take a rideshare alone. Public transport alone is not allowed.',
    approvedWording:
      'Because you will be sedated, a responsible adult has to drive you home and stay with you. A taxi or rideshare on your own will not be accepted.',
    onViolation: 'barrier',
  },
  {
    id: 'colonoscopy-arrival',
    procedure: 'colonoscopy',
    check: 'arrival',
    text: 'Arrive one hour before the scheduled procedure time to allow for check-in and pre-op. Arriving late may mean the case is rescheduled.',
    approvedWording: 'Please arrive one hour before your procedure time so there is room for check-in and pre-op.',
    onViolation: 'barrier',
  },

  // ── Anticoagulation and diabetes holds (apply across procedures) ─────
  {
    id: 'hold-anticoagulants',
    procedure: '*',
    check: 'medications',
    text: 'Blood thinners such as warfarin, apixaban, rivaroxaban, clopidogrel, and aspirin are held before the procedure on the schedule your clinician set. Taking a held blood thinner is a clinical issue and must be reviewed by the clinical team, not resolved on the phone.',
    approvedWording:
      'Blood thinners are held before your procedure on the schedule your clinician set. I am going to flag this for your care team to review.',
    onViolation: 'clinical',
  },
  {
    id: 'hold-nsaids',
    procedure: '*',
    check: 'medications',
    text: 'Ibuprofen, naproxen, and other anti-inflammatory painkillers are usually stopped several days before. Paracetamol and acetaminophen are generally allowed.',
    approvedWording:
      'Anti-inflammatory painkillers like ibuprofen are usually stopped several days before. Let me flag this so your care team can confirm.',
    onViolation: 'clinical',
  },
  {
    id: 'hold-diabetes-meds',
    procedure: '*',
    check: 'medications',
    text: 'Diabetes medication doses are adjusted when you are fasting. Insulin and metformin schedules change on the morning of the procedure. Do not guess the dose.',
    approvedWording:
      'Diabetes medicines are adjusted when you are fasting. I will have your care team confirm the exact dose for the morning.',
    onViolation: 'clinical',
  },

  // ── Warning symptoms (apply across procedures) ───────────────────────
  {
    id: 'symptoms-infection',
    procedure: '*',
    check: 'symptoms',
    text: 'A new fever, chills, productive cough, sore throat, shortness of breath, vomiting, or diarrhoea in the days before the procedure can mean the case is postponed. Any of these needs clinical review.',
    approvedWording:
      'Thank you for telling me. New symptoms like that need to be reviewed by your care team before tomorrow, so I am flagging this now.',
    onViolation: 'clinical',
  },
  {
    id: 'symptoms-chest-pain',
    procedure: '*',
    check: 'symptoms',
    text: 'New chest pain, palpitations, fainting, or severe shortness of breath are urgent and are escalated immediately rather than handled on this call.',
    approvedWording:
      'That needs to be looked at urgently. I am escalating this to your care team right now, and you should seek care if it gets worse.',
    onViolation: 'clinical',
  },

  // ── Cataract extraction ──────────────────────────────────────────────
  {
    id: 'cataract-npo',
    procedure: 'cataract-extraction',
    check: 'npo',
    text: 'No solid food for six hours before. Clear liquids are allowed up to two hours before unless you were told otherwise.',
    approvedWording: 'No solid food for six hours before, and clear liquids up to two hours before.',
    onViolation: 'barrier',
  },
  {
    id: 'cataract-transport',
    procedure: 'cataract-extraction',
    check: 'transport',
    text: 'Your eye will be patched and vision blurred, so someone must drive you home. You cannot drive yourself the same day.',
    approvedWording: 'Your vision will be blurred afterwards, so someone needs to drive you home.',
    onViolation: 'barrier',
  },
  {
    id: 'cataract-eye-drops',
    procedure: 'cataract-extraction',
    check: 'medications',
    text: 'Antibiotic and anti-inflammatory eye drops are started before the procedure on the schedule given, usually several times a day for a few days before.',
    approvedWording: 'Keep using the eye drops on the schedule you were given, right up to the procedure.',
    onViolation: 'barrier',
  },

  // ── Knee arthroscopy ─────────────────────────────────────────────────
  {
    id: 'knee-npo',
    procedure: 'knee-arthroscopy',
    check: 'npo',
    text: 'Nothing to eat after midnight. Small sips of water with essential medicines are allowed up to two hours before unless told otherwise.',
    approvedWording:
      'Nothing to eat after midnight. Small sips of water with your essential medicines are fine up to two hours before.',
    onViolation: 'barrier',
  },
  {
    id: 'knee-transport',
    procedure: 'knee-arthroscopy',
    check: 'transport',
    text: 'General anaesthetic is used and you will be on crutches, so a responsible adult must drive you home and stay overnight.',
    approvedWording: 'You will need a responsible adult to drive you home and stay with you overnight.',
    onViolation: 'barrier',
  },
  {
    id: 'knee-shaving',
    procedure: 'knee-arthroscopy',
    check: 'teachback',
    text: 'Do not shave the leg in the days before surgery, because small nicks raise the risk of infection. Shower with the antiseptic wash the night before.',
    approvedWording:
      'Do not shave the leg beforehand, and use the antiseptic wash in the shower the night before.',
    onViolation: 'barrier',
  },

  // ── Hernia repair ────────────────────────────────────────────────────
  {
    id: 'hernia-npo',
    procedure: 'hernia-repair',
    check: 'npo',
    text: 'Nothing to eat or drink after midnight, including chewing gum, mints, and sweets.',
    approvedWording: 'Nothing to eat or drink after midnight — that includes gum and mints.',
    onViolation: 'barrier',
  },
  {
    id: 'hernia-transport',
    procedure: 'hernia-repair',
    check: 'transport',
    text: 'You will be discharged the same day under anaesthetic and need a responsible adult to drive you home and stay for 24 hours.',
    approvedWording: 'You need someone to drive you home and stay with you for the first 24 hours.',
    onViolation: 'barrier',
  },
  {
    id: 'hernia-smoking',
    procedure: 'hernia-repair',
    check: 'teachback',
    text: 'Stopping smoking even a few days before improves wound healing and lowers the chance of a chest infection after anaesthetic.',
    approvedWording: 'Stopping smoking even a few days before helps the wound heal and protects your chest.',
    onViolation: 'barrier',
  },

  // ── Upper endoscopy ──────────────────────────────────────────────────
  {
    id: 'endoscopy-npo',
    procedure: 'upper-endoscopy',
    check: 'npo',
    text: 'Nothing to eat for eight hours and nothing to drink for four hours before. The stomach must be empty for the camera to see anything.',
    approvedWording: 'Nothing to eat for eight hours before, and nothing to drink for four hours before.',
    onViolation: 'barrier',
  },
  {
    id: 'endoscopy-dentures',
    procedure: 'upper-endoscopy',
    check: 'teachback',
    text: 'Loose dentures, dental plates, and oral piercings are removed before the procedure.',
    approvedWording: 'Any loose dentures or oral piercings need to come out before the procedure.',
    onViolation: 'barrier',
  },

  // ── Arrival and general logistics ────────────────────────────────────
  {
    id: 'arrival-general',
    procedure: '*',
    check: 'arrival',
    text: 'Bring photo ID and your insurance card. Wear loose comfortable clothing and leave jewellery and valuables at home. Contact lenses come out beforehand.',
    approvedWording:
      'Bring photo ID and your insurance card, wear loose comfortable clothes, and leave valuables at home.',
    onViolation: 'barrier',
  },
  {
    id: 'transport-companion-waiting',
    procedure: '*',
    check: 'transport',
    text: 'The person driving you home needs to be reachable and able to come back at short notice if the case finishes early.',
    approvedWording:
      'Whoever is driving you should be reachable in case the procedure finishes earlier than planned.',
    onViolation: 'barrier',
  },
];

/** Rules that apply to a given procedure: its own, plus the ones marked for every procedure. */
export function protocolsFor(procedure: string): ProtocolRule[] {
  return PROTOCOLS.filter((rule) => rule.procedure === procedure || rule.procedure === '*');
}
