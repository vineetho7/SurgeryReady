# SurgeryReady

A voice agent that closes the loop around an operation — before it, and after it.

---

# Part one: in plain English

## The problem

Two things go wrong around surgery, and both are quiet.

**The night before.** Operations get cancelled on the morning they were meant to happen.
Not because anything went wrong in theatre, but because the patient ate breakfast, or has
no one to drive them home, or took a blood thinner they were told to stop, or turned up
ten minutes before instead of an hour. An operating theatre standing empty is expensive,
and the patient goes to the back of the queue.

Clinics already try to prevent this. Someone calls the day before and reads out the
instructions. It does not work as well as you would hope, for a simple reason: **a patient
who is read a list will say yes to all of it.** Saying yes is polite. It is not the same
as understanding.

**The weeks after.** Once a patient goes home, the clinical team is blind until the next
appointment. Someone recovering from foot surgery is supposed to put a carefully
increasing amount of weight through that foot — very little at first, more as it heals.
Put too much on too early and you can damage the repair. Put too little on for too long
and you do not recover properly. Nobody knows which is happening until weeks later.

## What SurgeryReady does

**Before the operation**, the agent phones the patient and has an actual conversation. It
covers six things: when to arrive, when to stop eating and drinking, who is driving them
home, which medicines to hold, whether they have any new symptoms, and — the important one
— it asks them to explain the instructions *back in their own words*.

A seventh check happens without the patient: the system asks their insurer, in real time,
whether the coverage is actually active. Nobody can answer that question by phone, and a
case with unverified coverage gets pulled at the desk just as surely as one with no driver.

That last step is the whole idea. It is called teach-back, and it is what a good nurse
does. You cannot fake it with a checkbox. When Maria says *"I was planning to have coffee
with a little milk in the morning"*, that is a cancelled colonoscopy revealing itself the
day before instead of at 7am.

The agent does not tell her off and does not improvise medical advice. It looks up what
her clinician actually approved and reads that back:

> "Clear liquids only the day before, and nothing at all — not even water or coffee —
> after midnight. Anything with milk or cream in it does not count as a clear liquid."

Then it asks her to confirm.

**After the operation**, a pressure-sensing insole in the patient's shoe measures how hard
they press at five points on the foot, all day, and compares the operated foot against the
other one. Every 24 hours the system works out whether they are on track, and writes a
report. If they are not, it raises a task for the clinical team — and the agent can call
the patient to read the report back in plain language and ask whether it matches how the
foot actually feels.

## What the clinician sees

A board with everyone on it, sorted so the problems are at the top.

Nine patients are ready and need no attention at all. Three need something:

- **Harold** has no one to drive him home and was planning to take a taxi. A coordinator
  can fix that today.
- **Susan** thinks she should arrive ten minutes before, not an hour.
- **Edward** has had a fever and a productive cough since Thursday. That one is not a
  logistics problem — a human clinician needs to look at it before tomorrow.

And in recovery, **Rosa**, four days after a Lisfranc fixation, is walking on her foot
almost normally when she should barely be loading it at all.

The value is not the three rows the clinician reads. It is the nine they never have to.

## The rule that makes it safe

An AI that talks to patients about their medication is a frightening idea, and it should
be. So there is one rule underneath all of this:

> **The model runs the conversation. It never decides the outcome, and it never writes a
> clinical instruction.**

Whether a patient is "ready", or a recovery is "off track", is decided by arithmetic on
measurements — the same way every time, auditable, testable. And every clinical sentence
the agent speaks is retrieved from a library of clinician-approved wording and read out
close to verbatim. If it cannot find an approved answer, it says it will have the care
team confirm, and stops.

The agent's job is to notice things and escalate them. Deciding stays with clinicians.

## Why voice, and not a text message

This is the most common question, and it has a straightforward answer.

A text message asking "have you arranged transport home? Y/N" gets a Y. It gets a Y from
the patient who has arranged a lift, and from the patient who is planning to take a taxi
alone and does not know that is not allowed.

You cannot detect a misunderstanding through a button. You can only detect it by asking
someone to explain it back and listening to what they say. That requires an open-ended
answer, which requires speech.

---

# Part two: how it works

## Shape

```
   Patient / clinician
          │  speech
          ▼
   ┌─────────────┐   PCM audio    ┌──────────────┐   audio + tools   ┌──────────┐
   │   Browser   │ ◄────────────► │    Server    │ ◄───────────────► │ Deepgram │
   │  dashboard  │   websocket    │   (bridge)   │                   │  Agent   │
   └─────────────┘                └──────┬───────┘                   └──────────┘
          │                              │
          │ FHIR reads              tool │ calls
          ▼                              ▼
   ┌─────────────┐               ┌───────────────┐
   │   Medplum   │               │  Moss  index  │
   │   (FHIR)    │               │  (in-memory)  │
   └─────────────┘               └───────────────┘
```

The server sits in the middle for two reasons. The Deepgram key never reaches the browser,
and **tool calls are answered server-side** — so what the agent is allowed to say is not
something the page can tamper with.

## The decision functions

Two pure functions, no I/O, no model:

**`readiness(checks)`** → `ready` · `needs-attention` · `clinical-review` · `unknown`

Each of the six pre-op checks grades as confirmed, a logistical barrier, or something
needing clinical judgement. Clinical review outranks everything: a reported fever beats a
missing driver, always.

**`assess(session, previous)`** → `on-track` · `watch` · `off-track` · `insufficient-data`

Takes a day of insole data and the previous day's assessment. Overloading outranks
everything else, because it is the failure mode that causes harm rather than merely delay.

Both persist their verdict to FHIR — as a `meta.tag` on the QuestionnaireResponse, and as
`DiagnosticReport.conclusionCode`. **Nothing downstream re-derives state.** The dashboard
renders a stored verdict; it does not reimplement the rules.

## The insole model

Five plantar zones per foot: hallux, first metatarsal head, fifth metatarsal head,
midfoot, heel. Each reports peak pressure in kPa and how long it spent outside its
expected band.

The expected band is **indexed by post-operative day**, from a progressive weight-bearing
schedule:

| Days | Stage | Expected load |
| --- | --- | --- |
| 0–2 | Protected | 10–40% of normal |
| 3–7 | Partial | 30–60% |
| 8–14 | Progressive | 50–80% |
| 15–28 | Advancing | 70–95% |
| 29+ | Full | 85–110% |

The subtle part is asymmetry. Someone two days post-op is *supposed* to favour the
operated side — flagging that would flag every normal recovery. So the system computes the
asymmetry the protocol expects for that day and measures the gap. **Deviation from
schedule is the signal; raw asymmetry is not.**

This is what makes Rosa's case legible. Her asymmetry is 8%, which looks healthy. Expected
on day 4 is 55%. She is 47 points *below* expectation — she is walking on it like nothing
happened, four days after a Lisfranc fixation.

## Why retrieval has to be fast

A conversation tolerates about a second of silence before it feels broken. Inside one turn
the agent has to detect the end of speech, think, retrieve, and start speaking.

If grounding meant a live FHIR search, that is 150–300 ms per lookup, several per turn, and
the pause becomes audible. So everything the agent may say is flattened into a Moss index
and loaded into memory before the call starts. Measured in the running system:

```
moss: "coffee with a little milk in the morning" -> colonoscopy-npo-clear-liquids (0ms)
```

Note there is no keyword overlap between the query and the rule. The match is semantic —
"coffee with milk" resolves to a fasting rule that never mentions coffee by that phrasing.
A keyword index returns nothing here.

## Grounding contract

The agent gets two tools:

- **`lookup_protocol(question)`** — pass the patient's own words. Returns
  `say_this_verbatim`, the clinician-approved sentence, plus a severity that determines
  whether this is a coordinator problem or a clinical one.
- **`lookup_patient_report(name)`** — the stored conclusion and state for a patient, from
  Medplum.

The field is named `say_this_verbatim` deliberately. The model is not given latitude to
compose clinical language; it is given a sentence and told to read it.

## Data model (FHIR R4)

| Resource | Role |
| --- | --- |
| `Patient` | Everyone on the board |
| `Appointment` · `ServiceRequest` | The scheduled procedure |
| `Questionnaire` · `QuestionnaireResponse` | The six checks, with each answer's **verbatim patient utterance** alongside its grade |
| `Procedure` | The operation already performed |
| `Device` | The pressure insole |
| `Observation` | One gait session — per-zone peaks with their expected band as `referenceRange`, deviation seconds, asymmetry |
| `DiagnosticReport` | The 24-hour recovery report: `conclusion` prose, `conclusionCode` state |
| `Task` | Raised on a barrier, and **closed automatically when it resolves** |

Storing the verbatim utterance matters. A coordinator reviewing an exception needs the
patient's own words — *"I was going to get a cab, my wife does not drive"* — not a model's
paraphrase of them.

## Stack

- **Medplum** — hosted FHIR server, record of truth
- **Deepgram** — Voice Agent API over websocket, handling speech-to-text, turn-taking, and
  text-to-speech in one connection, with server-side function calling
- **Moss** — semantic index, loaded in-process for single-digit-millisecond retrieval
- **React + Vite + TypeScript** — dashboard, no component kit for the app surface
- **Node + ws** — the bridge

Browser audio is 16 kHz PCM up, 24 kHz down, with a scheduled playback queue so that
**barge-in works**: when the agent hears the user start talking, queued speech is flushed
rather than talked over.

## Interface decisions worth naming

**The foot map is diverging, not sequential.** A zone can be wrong in two opposite
directions — under-loaded or over-loaded — and the difference is clinical. So it runs blue
→ neutral → red with the neutral midpoint meaning "inside the protocol band", rather than
a single-hue intensity ramp that would collapse both failures into "more colour".

**Asymmetry is plotted against expectation on one axis.** Both series are the same unit, so
they share a scale. The gap between the lines is the finding.

**Status never rests on colour.** Every state ships an icon and a label. The palette was
run through a contrast and colour-vision-deficiency validator in both light and dark.

## Honest limitations

- **The insole data is simulated.** No hardware was connected. Sessions are generated
  deterministically — fixed seed per patient, so the same numbers appear every run — and
  written to FHIR through the same path real device data would take. The analysis is real;
  the measurements are not.
- **The clinical constants are placeholders.** Normative pressures, the weight-bearing
  schedule, and the deviation thresholds are plausible defaults for demonstration, isolated
  in one file, and would need clinical validation before meaning anything.
- **Procedure codes use a local code system**, not SNOMED. Language models reliably
  hallucinate clinical codes, and a made-up SNOMED code is worse than an honestly-scoped
  local one.
- **All patients are synthetic.** No real PHI at any point.
- **Eligibility runs against Stedi's sandbox, which has one fixture member.** The HTTP
  call, the parsing, and the benefit amounts are real, but test mode recognises exactly one
  subscriber per payer — Aetna answers only to member `AETNA12345` named Jane Doe and
  rejects any other name against that id. So patients with verified coverage are checked
  under that fixture identity. In production this is simply the patient's own member id.
  The unverified case is genuinely unverified: a real payer call returning
  "Subscriber/Insured Not Found".
- **The demo authenticates with a client secret in the browser** so there is no login
  screen. Acceptable for a local demo on synthetic data; a real deployment keeps that
  credential server-side and signs the clinician in as a user.

## Try it

See [SETUP.md](SETUP.md). The short version: seed the data, start the server, open the
dashboard, press *Patient call* on Maria Santos, and tell it you were planning to have
coffee with a little milk in the morning.
