import { ClientStorage, MedplumClient, MemoryStorage } from '@medplum/core';
import type { DiagnosticReport, Patient } from '@medplum/fhirtypes';
import { CONFIG } from './config.js';

/**
 * The agent's read access to the chart.
 *
 * Deliberately narrow: it can fetch the stored conclusion of a patient's latest report
 * and nothing else. The report was written by a deterministic assessment, so anything
 * the agent says about a patient traces back to arithmetic on measurements rather than
 * to the model's own reading of raw data.
 */

/* Explicit storage: see the note in seed/src/client.ts — Node's localStorage global
   throws unless --localstorage-file was passed, and MedplumClient prefers it if present. */
const medplum = new MedplumClient({
  baseUrl: CONFIG.medplum.baseUrl,
  storage: new ClientStorage(new MemoryStorage()),
});
let authenticated = false;

export async function initRecord(): Promise<void> {
  await medplum.startClientLogin(CONFIG.medplum.clientId, CONFIG.medplum.clientSecret);
  authenticated = true;
  console.log('Medplum client authenticated.');
}

/**
 * What the payer said about this patient, from the stored eligibility answer.
 *
 * Reads the disposition written at check time rather than calling the payer again: the
 * agent reports what is in the chart, and a live call mid-conversation would add a
 * second of silence for an answer that is already recorded.
 */
export async function coverageFor(patientName: string): Promise<
  { name: string; verified: boolean; insurer?: string; disposition: string; checkedAt?: string } | undefined
> {
  if (!authenticated) {
    return undefined;
  }
  const patients = await medplum.searchResources('Patient', `name=${encodeURIComponent(patientName)}&_count=5`);
  const patient: Patient | undefined = patients[0];
  if (!patient) {
    return undefined;
  }
  const responses = await medplum.searchResources(
    'CoverageEligibilityResponse',
    `patient=Patient/${patient.id}&_count=1`
  );
  const response = responses[0];
  if (!response) {
    return undefined;
  }
  return {
    name: `${patient.name?.[0]?.given?.join(' ') ?? ''} ${patient.name?.[0]?.family ?? ''}`.trim(),
    verified: response.outcome === 'complete',
    insurer: response.insurer?.display,
    disposition: response.disposition ?? 'No detail recorded.',
    checkedAt: response.created,
  };
}

/**
 * Comorbidities that bear on the current episode.
 *
 * Each carries the recorded reason it matters here, so the agent reads a clinician's
 * sentence rather than reasoning from a diagnosis to a consequence. It reports history;
 * it does not interpret it or advise on managing it.
 */
export async function historyFor(
  patientName: string
): Promise<{ name: string; conditions: { condition: string; bearing: string; since?: string }[] } | undefined> {
  if (!authenticated) {
    return undefined;
  }
  const patients = await medplum.searchResources('Patient', `name=${encodeURIComponent(patientName)}&_count=5`);
  const patient: Patient | undefined = patients[0];
  if (!patient) {
    return undefined;
  }
  const conditions = await medplum.searchResources('Condition', `subject=Patient/${patient.id}&_count=20`);
  return {
    name: `${patient.name?.[0]?.given?.join(' ') ?? ''} ${patient.name?.[0]?.family ?? ''}`.trim(),
    conditions: conditions.map((c) => ({
      condition: c.code?.text ?? c.code?.coding?.[0]?.display ?? 'Unknown',
      bearing: c.note?.[0]?.text ?? '',
      since: c.onsetDateTime?.slice(0, 4),
    })),
  };
}

export interface BoardEntry {
  name: string;
  stage: 'pre-op' | 'recovery';
  state: string;
  detail: string;
}

/**
 * Who needs attention right now, across both stages.
 *
 * "Which patients need me?" is the first thing a clinician asks, and answering it from a
 * single-patient lookup is impossible. Reads the stored verdicts — the readiness tag on
 * each QuestionnaireResponse and the conclusionCode on each recovery report — so the
 * agent reports the same states the board shows rather than forming its own view.
 */
export async function listAttention(): Promise<BoardEntry[]> {
  if (!authenticated) {
    return [];
  }

  const [responses, reports, appointments, patients] = await Promise.all([
    medplum.searchResources('QuestionnaireResponse', '_count=200'),
    medplum.searchResources('DiagnosticReport', '_count=400&_sort=-issued'),
    medplum.searchResources('Appointment', '_count=200'),
    medplum.searchResources('Patient', '_count=200'),
  ]);

  const nameOf = new Map(
    patients.map((p) => [
      `Patient/${p.id}`,
      `${p.name?.[0]?.given?.join(' ') ?? ''} ${p.name?.[0]?.family ?? ''}`.trim(),
    ])
  );

  const entries: BoardEntry[] = [];

  for (const response of responses) {
    const ref = response.subject?.reference;
    const tag = response.meta?.tag?.find((t) => t.system === 'http://surgeryready.local/readiness');
    if (!ref || !tag?.code || tag.code === 'ready') {
      continue;
    }
    entries.push({
      name: nameOf.get(ref) ?? 'Unknown',
      stage: 'pre-op',
      state: tag.display ?? tag.code,
      detail: appointments.find((a) =>
        a.participant?.some((p) => p.actor?.reference === ref)
      )?.description ?? '',
    });
  }

  // Scheduled but never called — invisible to the readiness tags, and exactly the gap a
  // coordinator needs to know about.
  for (const appointment of appointments) {
    const ref = appointment.participant?.find((p) => p.actor?.reference?.startsWith('Patient/'))?.actor?.reference;
    if (!ref || responses.some((r) => r.subject?.reference === ref)) {
      continue;
    }
    entries.push({
      name: nameOf.get(ref) ?? 'Unknown',
      stage: 'pre-op',
      state: 'Not yet called',
      detail: appointment.description ?? '',
    });
  }

  const seen = new Set<string>();
  for (const report of reports) {
    const ref = report.subject?.reference;
    if (!ref || seen.has(ref) || report.code?.coding?.[0]?.code !== 'recovery-report-24h') {
      continue;
    }
    seen.add(ref); // reports are newest-first, so the first per patient is the current one
    const coding = report.conclusionCode?.[0]?.coding?.find(
      (c) => c.system === 'http://surgeryready.local/recovery-state'
    );
    if (!coding?.code || coding.code === 'on-track') {
      continue;
    }
    entries.push({
      name: nameOf.get(ref) ?? 'Unknown',
      stage: 'recovery',
      state: coding.display ?? coding.code,
      detail: report.conclusion?.split('.').slice(0, 2).join('.') ?? '',
    });
  }

  return entries;
}

export interface PatientSummary {
  name: string;
  conclusion: string;
  state: string;
  issued?: string;
}

export async function latestReportFor(patientName: string): Promise<PatientSummary | undefined> {
  if (!authenticated) {
    return undefined;
  }
  const patients = await medplum.searchResources('Patient', `name=${encodeURIComponent(patientName)}&_count=5`);
  const patient: Patient | undefined = patients[0];
  if (!patient) {
    return undefined;
  }
  const reports = await medplum.searchResources(
    'DiagnosticReport',
    `subject=Patient/${patient.id}&_sort=-issued&_count=1`
  );
  const report: DiagnosticReport | undefined = reports[0];
  if (!report) {
    return undefined;
  }
  const given = patient.name?.[0]?.given?.join(' ') ?? '';
  return {
    name: `${given} ${patient.name?.[0]?.family ?? ''}`.trim(),
    conclusion: report.conclusion ?? 'No conclusion recorded.',
    state: report.conclusionCode?.[0]?.coding?.[0]?.display ?? 'Unknown',
    issued: report.issued,
  };
}
