import type { CheckId, CheckResult } from './systems.js';

/** One already-completed check on a call that has already happened. */
export interface SeededCheck {
  result: CheckResult;
  utterance: string;
}

export interface BoardCase {
  /** Stable key — used as the seed identifier so re-runs update rather than duplicate. */
  key: string;
  given: string;
  family: string;
  birthDate: string;
  phone: string;
  /** Local procedure code, matches ProtocolRule.procedure. */
  procedure: string;
  procedureDisplay: string;
  /** Hour of the day tomorrow, 24h. */
  hour: number;
  minute: number;
  language?: { code: string; display: string };
  /**
   * Results of the readiness call, if it has already happened.
   * Undefined means the call has not been made — readiness derives to 'unknown'.
   */
  checks?: Record<CheckId, SeededCheck>;
  /** Barrier text for the Task, when the call produced one. */
  barrier?: { check: CheckId; summary: string };
}

const ok = (utterance: string): SeededCheck => ({ result: 'confirmed', utterance });

/**
 * Tomorrow's surgery board.
 *
 * Eight ready, three flagged, and Maria — whose call happens live on stage.
 * The nine rows a coordinator never has to look at are the entire point of the product,
 * so they have to actually be on the screen.
 */
export const BOARD: BoardCase[] = [
  {
    key: 'maria-santos',
    given: 'Maria',
    family: 'Santos',
    birthDate: '1962-04-11',
    phone: '+1-415-555-0142',
    procedure: 'colonoscopy',
    procedureDisplay: 'Colonoscopy',
    hour: 7,
    minute: 30,
    language: { code: 'en-US', display: 'English (United States)' },
    // No checks: this is the live demo call.
  },
  {
    key: 'james-okonkwo',
    given: 'James',
    family: 'Okonkwo',
    birthDate: '1955-09-02',
    phone: '+1-415-555-0177',
    procedure: 'knee-arthroscopy',
    procedureDisplay: 'Knee arthroscopy',
    hour: 8,
    minute: 0,
    checks: {
      arrival: ok('Seven in the morning, an hour before, at the third floor desk.'),
      npo: ok('Nothing after midnight. I already moved dinner earlier.'),
      transport: ok('My daughter is driving me and staying the night.'),
      medications: ok('I stopped the ibuprofen last Tuesday like they said.'),
      symptoms: ok('No, nothing. I feel fine.'),
      teachback: ok('No food after midnight, no shaving the leg, wash with the special soap tonight.'),
    },
  },
  {
    key: 'dorothy-klein',
    given: 'Dorothy',
    family: 'Klein',
    birthDate: '1948-01-23',
    phone: '+1-415-555-0193',
    procedure: 'cataract-extraction',
    procedureDisplay: 'Cataract extraction',
    hour: 8,
    minute: 30,
    checks: {
      arrival: ok('Half seven, and I bring the ID and the insurance card.'),
      npo: ok('No breakfast. Water up to two hours before, they said.'),
      transport: ok('My neighbour Ruth is taking me both ways.'),
      medications: ok('The drops four times a day, started Wednesday.'),
      symptoms: ok('Nothing new, no.'),
      teachback: ok('No solid food after two in the morning, drops as normal, Ruth drives.'),
    },
  },
  {
    key: 'aiden-murphy',
    given: 'Aiden',
    family: 'Murphy',
    birthDate: '1991-06-30',
    phone: '+1-415-555-0108',
    procedure: 'hernia-repair',
    procedureDisplay: 'Hernia repair',
    hour: 9,
    minute: 0,
    checks: {
      arrival: ok('Eight, an hour before. Got it in my calendar.'),
      npo: ok('Nothing after midnight, not even gum. I read that part twice.'),
      transport: ok('My partner is taking the day off to stay with me.'),
      medications: ok('Nothing to hold, I only take the allergy tablet.'),
      symptoms: ok('All good.'),
      teachback: ok('Fast from midnight, partner drives, no smoking — I quit two weeks ago.'),
    },
  },
  {
    key: 'priya-raman',
    given: 'Priya',
    family: 'Raman',
    birthDate: '1979-11-14',
    phone: '+1-415-555-0166',
    procedure: 'upper-endoscopy',
    procedureDisplay: 'Upper endoscopy',
    hour: 9,
    minute: 30,
    checks: {
      arrival: ok('Half eight at the endoscopy unit.'),
      npo: ok('No food from midnight, no drinks from about five in the morning.'),
      transport: ok('My brother is collecting me at eleven.'),
      medications: ok('Held the omeprazole for two weeks as instructed.'),
      symptoms: ok('No fever, no cough, nothing.'),
      teachback: ok('Empty stomach, eight hours no food, brother drives, take the piercing out.'),
    },
  },
  {
    key: 'walter-briggs',
    given: 'Walter',
    family: 'Briggs',
    birthDate: '1943-03-08',
    phone: '+1-415-555-0121',
    procedure: 'colonoscopy',
    procedureDisplay: 'Colonoscopy',
    hour: 10,
    minute: 0,
    checks: {
      arrival: ok('Nine sharp. My son wrote it on the fridge.'),
      npo: ok('Clear liquids yesterday, nothing after midnight. Broth and apple juice.'),
      transport: ok('My son is driving and waiting there the whole time.'),
      medications: ok('Held the aspirin five days ago, the nurse confirmed it.'),
      symptoms: ok('Nothing, I am well.'),
      teachback: ok('Finish the second half of the prep at four in the morning, nothing to drink after.'),
    },
  },
  {
    key: 'nina-alvarez',
    given: 'Nina',
    family: 'Alvarez',
    birthDate: '1986-07-19',
    phone: '+1-415-555-0135',
    procedure: 'knee-arthroscopy',
    procedureDisplay: 'Knee arthroscopy',
    hour: 10,
    minute: 30,
    checks: {
      arrival: ok('Half nine, loose clothes, no jewellery.'),
      npo: ok('Nothing after midnight, small sip of water with my tablet.'),
      transport: ok('My mother is driving and staying over.'),
      medications: ok('No blood thinners. Just the inhaler, which I keep.'),
      symptoms: ok('No, nothing new.'),
      teachback: ok('Fast from midnight, mum drives and stays, do not shave the knee.'),
    },
  },
  {
    key: 'tobias-lindqvist',
    given: 'Tobias',
    family: 'Lindqvist',
    birthDate: '1968-12-05',
    phone: '+1-415-555-0159',
    procedure: 'hernia-repair',
    procedureDisplay: 'Hernia repair',
    hour: 11,
    minute: 0,
    checks: {
      arrival: ok('Ten in the morning, main entrance, ask for day surgery.'),
      npo: ok('Nothing from midnight. No gum, no mints.'),
      transport: ok('Colleague is driving me, wife is home all day after.'),
      medications: ok('Nothing held. I checked with the pharmacist too.'),
      symptoms: ok('Fine, no fever.'),
      teachback: ok('Nothing to eat or drink from midnight, someone with me 24 hours.'),
    },
  },
  {
    key: 'grace-oyelaran',
    given: 'Grace',
    family: 'Oyelaran',
    birthDate: '1974-02-28',
    phone: '+1-415-555-0184',
    procedure: 'cataract-extraction',
    procedureDisplay: 'Cataract extraction',
    hour: 11,
    minute: 30,
    checks: {
      arrival: ok('Half ten. I have the letter with the floor on it.'),
      npo: ok('No food from half four in the morning, water till half nine.'),
      transport: ok('My son and my sister are both coming.'),
      medications: ok('Drops three times a day since Monday.'),
      symptoms: ok('Nothing.'),
      teachback: ok('No solid food six hours before, keep the drops going, someone drives me back.'),
    },
  },

  // ── The three exceptions ─────────────────────────────────────────────
  {
    key: 'harold-vance',
    given: 'Harold',
    family: 'Vance',
    birthDate: '1951-05-16',
    phone: '+1-415-555-0112',
    procedure: 'colonoscopy',
    procedureDisplay: 'Colonoscopy',
    hour: 13,
    minute: 0,
    checks: {
      arrival: ok('Twelve o clock, one hour before.'),
      npo: ok('Clear liquids all day yesterday, nothing after midnight.'),
      transport: {
        result: 'barrier',
        utterance: 'I was going to get a cab. My wife does not drive and my son is away this week.',
      },
      medications: ok('Held the aspirin, yes.'),
      symptoms: ok('No, I am fine.'),
      teachback: ok('Nothing to eat or drink after midnight, finish the prep early morning.'),
    },
    barrier: {
      check: 'transport',
      summary: 'No responsible adult to drive home after sedation. Patient planned to take a taxi alone.',
    },
  },
  {
    key: 'susan-whitfield',
    given: 'Susan',
    family: 'Whitfield',
    birthDate: '1959-08-21',
    phone: '+1-415-555-0147',
    procedure: 'upper-endoscopy',
    procedureDisplay: 'Upper endoscopy',
    hour: 14,
    minute: 0,
    checks: {
      arrival: {
        result: 'barrier',
        utterance: 'Two o clock, right? I will come straight from work at about ten to.',
      },
      npo: ok('No food from six in the morning, no drinks from ten.'),
      transport: ok('My husband is picking me up.'),
      medications: ok('Nothing to hold.'),
      symptoms: ok('No, nothing.'),
      teachback: ok('Empty stomach, husband collects me, no driving myself.'),
    },
    barrier: {
      check: 'arrival',
      summary: 'Patient plans to arrive 10 minutes before procedure time, not the required 1 hour.',
    },
  },
  {
    key: 'edward-nakamura',
    given: 'Edward',
    family: 'Nakamura',
    birthDate: '1946-10-03',
    phone: '+1-415-555-0129',
    procedure: 'knee-arthroscopy',
    procedureDisplay: 'Knee arthroscopy',
    hour: 15,
    minute: 0,
    checks: {
      arrival: ok('Two in the afternoon.'),
      npo: ok('Nothing after midnight.'),
      transport: ok('My wife is driving me and staying.'),
      medications: ok('I stopped the ibuprofen a week ago.'),
      symptoms: {
        result: 'clinical',
        utterance: 'I have had a bit of a temperature since Thursday and a cough that brings stuff up.',
      },
      teachback: ok('No food from midnight, wife drives, no shaving the leg.'),
    },
    barrier: {
      check: 'symptoms',
      summary: 'New fever and productive cough since Thursday. Requires clinical review before proceeding.',
    },
  },
];
