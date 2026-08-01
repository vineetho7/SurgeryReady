# SurgeryReady

A closed-loop preoperative readiness agent. Before a scheduled procedure, a voice agent
calls the patient, confirms understanding through conversational teach-back, identifies
barriers early, and escalates exceptions to the clinical team.

Built for the YC x Medplum Agentic Healthcare Hackathon, Aug 1 2026.

**New here? Read [ABOUT.md](ABOUT.md)** — the problem and the product in plain English
first, then the architecture. [SETUP.md](SETUP.md) gets it running.

## The problem

Same-day surgery cancellations waste operating room time and displace patients. Most are
preventable and known the day before: the patient ate breakfast, has no ride home, took a
medication they were told to hold, or their coverage was never verified.

Reminder calls already exist. They do not work, because a patient who is read a list of
instructions will say "yes" to all of them without understanding any of them.

## What this does differently

- **Teach-back, not readout.** The agent asks the patient to explain the instruction in
  their own words, and detects when the explanation is wrong.
- **Never gives medical advice.** On a mismatch it restates the clinician-approved
  instruction and escalates. Clinical decisions stay with clinicians.
- **Produces structured records.** Every call writes a `QuestionnaireResponse` and, where a
  barrier exists, a `Task` for the clinical team.
- **Surfaces only exceptions.** The clinician sees the three patients who need attention,
  not the nine who are ready.

## Readiness states

| State | Meaning |
| --- | --- |
| Ready | All requirements confirmed |
| Needs attention | Logistical barrier (no driver, wrong arrival time, coverage unverified) |
| Clinical review | Patient reported something requiring human clinical judgment |

## Stack

| Technology | Role |
| --- | --- |
| Medplum | FHIR record of truth — Patient, Appointment, Questionnaire, QuestionnaireResponse, Task |
| Deepgram | Real-time speech-to-text and text-to-speech for the patient call |
| Moss | Low-latency semantic retrieval of procedure-specific prep protocols during the call |
| Stedi | Insurance eligibility, surfaced as a readiness barrier |

## Layout

```
app/      Vite + React + @medplum/react clinician dashboard
server/   Voice agent orchestration: Deepgram, Moss, Stedi, Medplum write-back
seed/     Synthetic patients, questionnaire definition, prep-protocol corpus
```

## Running

See **[SETUP.md](SETUP.md)** for credentials, environment files, seeding, and the demo
script.

```bash
cd seed   && npm install && npm run seed   # demo data into Medplum
cd ../server && npm install && npm start   # voice agent on :8080
cd ../app    && npm install && npm run dev # dashboard on :3000
```
