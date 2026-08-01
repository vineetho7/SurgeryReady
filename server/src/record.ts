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
