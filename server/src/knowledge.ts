import { MossClient } from '@moss-dev/moss';
import { CONFIG } from './config.js';
import { PROTOCOLS } from '../../seed/src/protocols.js';
import { WEIGHT_BEARING_SCHEDULE, ZONE_LABEL } from '../../seed/src/recovery/zones.js';

/**
 * The agent's grounding.
 *
 * Every rule the agent is allowed to say out loud lives in this index. The index is
 * loaded into memory at boot, so a lookup mid-sentence costs single-digit milliseconds
 * — the whole reason the conversation can stay grounded without going silent while it
 * thinks. A live FHIR search here would cost 150–300ms per turn and the pause would be
 * audible.
 */

const INDEX = 'surgeryready-protocols';

let client: MossClient | undefined;
let ready = false;

/** Prep rules plus post-op weight-bearing guidance, phrased the way patients speak. */
type IndexDoc = { id: string; text: string; metadata: Record<string, string> };

function documents(): IndexDoc[] {
  // Annotated so the post-op rules below can widen `check` beyond the six pre-op ids.
  const docs: IndexDoc[] = PROTOCOLS.map((rule) => ({
    id: rule.id,
    text: rule.text,
    metadata: {
      kind: 'preop',
      procedure: rule.procedure,
      check: rule.check,
      approvedWording: rule.approvedWording,
      onViolation: rule.onViolation,
    },
  }));

  for (const stage of WEIGHT_BEARING_SCHEDULE) {
    docs.push({
      id: `weight-bearing-${stage.label.toLowerCase()}`,
      text: `Days ${stage.fromDay} to ${stage.toDay} after surgery is the ${stage.label.toLowerCase()} weight-bearing stage. Put between ${Math.round(stage.min * 100)}% and ${Math.round(stage.max * 100)}% of normal load through the operated foot. Standing on it harder than that, walking without the boot, or going up on the toes too early loads the repair before it can take it.`,
      metadata: {
        kind: 'postop',
        procedure: '*',
        check: 'weight-bearing',
        approvedWording: `You are in the ${stage.label.toLowerCase()} stage, so keep the weight through that foot between about ${Math.round(stage.min * 100)}% and ${Math.round(stage.max * 100)}% of normal. I will flag anything outside that for your care team.`,
        onViolation: 'clinical',
      },
    });
  }

  docs.push({
    id: 'insole-what-it-measures',
    text: `The insole measures how hard you press at five places on the foot: ${Object.values(ZONE_LABEL).join(', ')}. It compares the operated foot against the other one and against what your recovery stage expects, and reports how long you spent outside that range.`,
    metadata: {
      kind: 'postop',
      procedure: '*',
      check: 'device',
      approvedWording:
        'The insole measures pressure at five points on your foot and compares it with your other foot and with what your stage of recovery expects.',
      onViolation: 'barrier',
    },
  });

  return docs;
}

export async function initKnowledge(): Promise<void> {
  if (!CONFIG.moss.projectId || !CONFIG.moss.projectKey) {
    console.warn('Moss credentials missing — retrieval disabled, agent will decline to quote instructions.');
    return;
  }
  client = new MossClient(CONFIG.moss.projectId, CONFIG.moss.projectKey);
  const docs = documents();
  try {
    await client.createIndex(INDEX, docs);
  } catch (err) {
    // Index already exists from a previous boot; loading it is enough.
    console.warn('createIndex skipped:', (err as Error).message);
  }
  await client.loadIndex(INDEX);
  ready = true;
  console.log(`Moss index "${INDEX}" loaded in memory with ${docs.length} rules.`);
}

export interface Grounding {
  approvedWording: string;
  rule: string;
  severity: string;
  score: number;
  latencyMs: number;
}

/**
 * Resolve a patient utterance to the clinician-approved instruction.
 *
 * Returns `approvedWording` — the exact sentence the agent may speak. The model does
 * not compose clinical instructions; it reads these back. That constraint is what keeps
 * a conversational agent out of giving medical advice.
 */
export async function lookupProtocol(question: string): Promise<Grounding | undefined> {
  if (!client || !ready) {
    return undefined;
  }
  const started = performance.now();
  const result = await client.query(INDEX, question, { topK: 1, alpha: 0.7 });
  const hit = result.docs?.[0];
  if (!hit) {
    return undefined;
  }
  return {
    approvedWording: hit.metadata?.approvedWording ?? hit.text,
    rule: hit.id,
    severity: hit.metadata?.onViolation ?? 'barrier',
    score: hit.score,
    latencyMs: Math.round((result.timeTakenInMs ?? performance.now() - started) * 100) / 100,
  };
}
