# Setup

From a fresh clone to a working demo in about ten minutes, most of which is
creating four free accounts.

## Prerequisites

- **Node 22.18+ or 24.2+** (`node --version`). The app pins this in `engines`.
- A **Chromium-based browser** for the voice demo. The microphone path uses
  `AudioContext` at a fixed sample rate; `localhost` counts as a secure context, so
  `getUserMedia` works without HTTPS.

## 1. Credentials

Four services. Three are required; Stedi is not wired up yet.

| Service | Where | What you create | You end up with |
| --- | --- | --- | --- |
| **Medplum** | [app.medplum.com](https://app.medplum.com) | Register a project, then **Project Admin → Client Applications → new** | Client **ID** and **Secret** |
| **Deepgram** | [console.deepgram.com/signup](https://console.deepgram.com/signup) | **API Keys → create** | One API key ($200 free credits) |
| **Moss** | [portal.usemoss.dev](https://portal.usemoss.dev) | Verify email, then **Create Index** | Project **ID** and **Key** |
| **Stedi** *(optional)* | [stedi.com](https://www.stedi.com) | **API Keys → Generate**, type **Test** | A `test`-prefixed key |

Two things people get wrong here:

- **Medplum needs two credentials, not one.** Your personal login gets you into the
  Medplum console. The *ClientApplication* ID and secret are a separate thing you create
  inside the project, and they are what this app and the server authenticate with.
- **Moss's console is `portal.usemoss.dev`**, not `moss.dev`. The marketing site and the
  console are different domains.

## 2. Environment files

Two files, and the same Medplum credentials go in both.

```bash
cp server/.env.example server/.env
```

Fill in `server/.env`:

```
MEDPLUM_BASE_URL=https://api.medplum.com/
MEDPLUM_CLIENT_ID=...
MEDPLUM_CLIENT_SECRET=...
DEEPGRAM_API_KEY=...
MOSS_PROJECT_ID=...
MOSS_PROJECT_KEY=...
STEDI_API_KEY=
PORT=8080
```

Then `app/.env` — Vite creates it from `.env.defaults` on first run, but it needs the
credentials adding. Only variables prefixed `MEDPLUM_` are exposed to the browser
(`envPrefix` in `vite.config.ts`):

```
MEDPLUM_BASE_URL=https://api.medplum.com/
MEDPLUM_CLIENT_ID=...
MEDPLUM_CLIENT_SECRET=...
```

Both `.env` files are gitignored. `server/.env.example` is not — keep real values out of
it.

> The app authenticates itself with the client secret so there is no login screen. That
> puts the secret in the browser bundle, which is fine for a local demo on synthetic data
> and is not how this would ship. A real deployment keeps the credential on the server
> and signs the clinician in as a user.

## 3. Install and seed

Order matters: the seeder reads `server/.env`, so create that first.

```bash
cd seed   && npm install && npm run seed
cd ../server && npm install
cd ../app    && npm install
```

`npm run seed` is idempotent — it conditionally updates rather than creating, so you can
re-run it any number of times without duplicating anyone. It prints tomorrow's board and
the recovery cohort:

```
PRE-OP — tomorrow's board:
  07:30  Maria Santos      Colonoscopy         Not yet called
  ...
POST-OP — recovery monitoring:
  POD  4  Rosa Iqbal       Lisfranc fixation   Off track
```

Check it landed correctly at any point:

```bash
cd seed && npm run verify
```

Counts are exact, not lower bounds. If `Patient` exceeds the roster, a seed run created
duplicates and the board will show someone twice.

## 4. Run

Two terminals.

```bash
cd server && npm start     # ws://localhost:8080/agent
cd app    && npm run dev   # http://localhost:3000
```

The server takes a few seconds to start — it authenticates against Medplum and loads the
protocol index into memory before it listens. Wait for:

```
Medplum client authenticated.
Moss index "surgeryready-protocols" loaded in memory with 28 rules.
Voice agent listening on ws://localhost:8080/agent
```

The app opens straight onto the board. No sign-in.

## 5. Try it

**Post-op.** Open **Rosa Iqbal** (post-op day 4, off track). Press *Ask about this
patient* and say *"How is her recovery going?"* — the agent answers from the stored
report.

**Pre-op teach-back.** Open **Maria Santos**, switch the voice panel to **Patient call**,
and start it. Say:

> "I was planning to have coffee with a little milk in the morning."

The agent resolves that to the fasting rule and reads back the clinician-approved
wording. Nothing in that sentence keyword-matches "nothing by mouth" — the retrieval is
semantic, and it returns in single-digit milliseconds, which is why the conversation
doesn't stall while it thinks.

Every clinical sentence is retrieved, never composed. The panel counts the grounded
lookups underneath the transcript.

If the room is loud or the microphone misbehaves, the text box under the transcript
injects into the same conversation.

## Useful commands

| Command | Where | What it does |
| --- | --- | --- |
| `npm run seed` | `seed/` | Create or update all demo data |
| `npm run verify` | `seed/` | Exact-count check on the seeded project |
| `npx vitest run` | `seed/` | Tests for the recovery state machine |
| `npm start` | `server/` | Run the voice agent |
| `npm run dev` | `server/` | Same, restarting on change |
| `node testcall.mjs` | `server/` | Drive a scripted call with no browser |
| `npm run dev` | `app/` | Dashboard on :3000 |
| `npm run build` | `app/` | Production build |
| `node shot.mjs / out.png dark` | `app/` | Screenshot a route, report console errors |

`/preview` renders every visual component against fixed data with no authentication —
useful for checking layout without touching the live project.

## Troubleshooting

**Voice panel says "Agent offline."** The server isn't running or isn't up yet. Watch for
the `listening` line; the Moss index load takes a few seconds.

**"Microphone blocked."** Allow the mic for `localhost:3000`, or type into the box under
the transcript instead.

**"Not connected to Medplum."** The screen names the reason. If it mentions rate limiting,
Medplum capped the number of sign-in grants (160 per window) — the app reuses its token
across reloads, but a long session of hard refreshes can still reach the ceiling. Wait the
stated number of seconds and press *Retry connection*.

**The board is empty but the app says it is connected.** The app and the seeder are
pointed at different Medplum projects. Both read the same client ID — confirm
`MEDPLUM_CLIENT_ID` matches in `app/.env` and `server/.env`.

**`npm run verify` fails on counts.** A seed identifier changed between runs, leaving
orphans. The seeded resources all carry `http://surgeryready.local/seed-id`; delete those
in the Medplum console and re-seed.

**Port already in use.** The app is fixed to 3000 in `vite.config.ts`. The server reads
`PORT` from `server/.env` — change it there and set `VITE_AGENT_URL` in `app/.env` to
match.

## Notes

All patient data is synthetic and generated deterministically — the same seed produces
the same numbers every run, so the demo never shifts under you.

Clinical constants (normative pressures, the weight-bearing schedule, deviation
thresholds) are placeholders for demonstration, isolated at the top of
`seed/src/recovery/zones.ts`, and would need clinical review before meaning anything.
Procedure codes use a local code system rather than invented SNOMED codes.
