import { getReferenceString } from '@medplum/core';
import type {
  Appointment,
  DiagnosticReport,
  Observation,
  ObservationComponent,
  Patient,
  QuestionnaireResponse,
  Task,
} from '@medplum/fhirtypes';
import { useMedplum, useMedplumProfile } from '@medplum/react';
import { useEffect, useState } from 'react';
import {
  CHECKS,
  SYSTEM,
  ZONES,
  type CheckId,
  type CheckResult,
  type Readiness,
  type RecoveryState,
  type Zone,
} from './model';

// ── Shapes the UI renders ─────────────────────────────────────────────

export interface PreopCheck {
  id: CheckId;
  result: CheckResult;
  utterance: string;
}

export interface RelevantCondition {
  condition: string;
  bearing: string;
  since?: string;
}

export interface PreopCase {
  patientId: string;
  name: string;
  procedure: string;
  start?: string;
  readiness: Readiness;
  /** What the payer said when asked, from the stored CoverageEligibilityResponse. */
  coverage?: { verified: boolean; disposition: string; insurer?: string };
  history: RelevantCondition[];
  checks: PreopCheck[];
  barrier?: string;
}

export interface ZoneReading {
  zone: Zone;
  peakKpa: number;
  bandLow: number;
  bandHigh: number;
  deviationSeconds: number;
  contralateralKpa: number;
}

export interface RecoveryDay {
  postOpDay: number;
  date: string;
  asymmetry: number;
  /**
   * What the weight-bearing protocol expects on this day — same unit, so one axis.
   *
   * Optional: the recordings pushed by the insole pipeline carry a measured asymmetry
   * and no protocol band, and inventing a band for them would put a line on the chart
   * that no resource in the project says.
   */
  expectedAsymmetry?: number;
  /** Mean operated load as a fraction of the day's band midpoint. 1.0 means dead centre. */
  loadIndex: number;
  state: RecoveryState;
}

export interface RecoveryCase {
  patientId: string;
  name: string;
  procedure: string;
  side: string;
  postOpDay: number;
  state: RecoveryState;
  conclusion: string;
  issued?: string;
  zones: ZoneReading[];
  stanceMinutes: number;
  history: RecoveryDay[];
  /** Comorbidities that change how the verdict should be read. */
  conditions: RelevantCondition[];
}

export interface Board {
  preop: PreopCase[];
  recovery: RecoveryCase[];
}

// ── Component helpers ─────────────────────────────────────────────────

function comp(obs: Observation, code: string): ObservationComponent | undefined {
  return obs.component?.find((c) => c.code?.coding?.some((x) => x.code === code));
}

function num(obs: Observation, code: string): number {
  const c = comp(obs, code);
  return c?.valueQuantity?.value ?? c?.valueInteger ?? 0;
}

function tagValue(resource: { meta?: { tag?: { system?: string; code?: string }[] } }, system: string): string | undefined {
  return resource.meta?.tag?.find((t) => t.system === system)?.code;
}

function displayName(patient?: Patient): string {
  const name = patient?.name?.[0];
  return name ? `${name.given?.join(' ') ?? ''} ${name.family ?? ''}`.trim() : 'Unknown';
}

/** A plain-valued Observation among a report's results, by code. */
function valueOf(results: Observation[], code: string): number | undefined {
  const obs = results.find((o) => o.code?.coding?.some((c) => c.code === code));
  return obs?.valueQuantity?.value;
}

/**
 * One day of the trend, whichever writer produced the report.
 *
 * Two pipelines write `recovery-report-24h` into this project. The seed writes a single
 * Observation with everything in components — `asymmetry-index`, `expected-asymmetry`,
 * `post-op-day`. The insole pipeline writes several plain Observations per report —
 * `steps`, `asymmetry-pct`, `pain-score` — with the day only in the report's conclusion.
 * Reading the first result and asking for components returns 0 for the second shape,
 * which is a chart with every point stacked on the origin. Both shapes are read here.
 */
function recoveryDayOf(report: DiagnosticReport, results: Observation[], index: number): RecoveryDay | undefined {
  const composite = results.find((o) => comp(o, 'asymmetry-index'));
  if (composite) {
    return {
      postOpDay: num(composite, 'post-op-day'),
      date: report.effectiveDateTime ?? '',
      asymmetry: num(composite, 'asymmetry-index'),
      expectedAsymmetry: num(composite, 'expected-asymmetry'),
      loadIndex: loadIndexOf(composite),
      state: recoveryStateOf(report),
    };
  }

  // Percent on the wire, fraction on the axis — the chart's other series is a fraction.
  const percent = valueOf(results, 'asymmetry-pct');
  if (percent === undefined) {
    return undefined;
  }
  const stated = /day\s+(\d+)/i.exec(report.conclusion ?? '');
  return {
    postOpDay: stated ? Number(stated[1]) : index + 1,
    date: report.effectiveDateTime ?? '',
    asymmetry: percent / 100,
    loadIndex: 0,
    state: recoveryStateOf(report),
  };
}

function recoveryStateOf(report: DiagnosticReport): RecoveryState {
  const code = report.conclusionCode?.[0]?.coding?.find((c) => c.system === SYSTEM.recoveryState)?.code;
  return (code as RecoveryState) ?? 'insufficient-data';
}

// ── The load ──────────────────────────────────────────────────────────

async function loadBoard(medplum: ReturnType<typeof useMedplum>): Promise<Board> {
  const [patients, appointments, responses, tasks, reports, observations, procedures, eligibility, conditions] =
    await Promise.all([
    medplum.searchResources('Patient', '_count=200'),
    medplum.searchResources('Appointment', '_count=200'),
    medplum.searchResources('QuestionnaireResponse', '_count=200'),
    medplum.searchResources('Task', '_count=200'),
    medplum.searchResources('DiagnosticReport', '_count=400&_sort=-issued'),
    medplum.searchResources('Observation', '_count=400'),
    medplum.searchResources('Procedure', '_count=200'),
    medplum.searchResources('CoverageEligibilityResponse', '_count=200'),
    medplum.searchResources('Condition', '_count=200'),
  ]);

  /** Conditions carry the recorded reason they matter, so nothing downstream infers it. */
  const historyFor = (ref: string): RelevantCondition[] =>
    conditions
      .filter((c) => c.subject?.reference === ref)
      .map((c) => ({
        condition: c.code?.text ?? c.code?.coding?.[0]?.display ?? 'Unknown',
        bearing: c.note?.[0]?.text ?? '',
        since: c.onsetDateTime?.slice(0, 4),
      }));

  const byId = new Map(patients.map((p) => [`Patient/${p.id}`, p]));

  // ── Pre-op ──
  const preop: PreopCase[] = [];
  for (const appointment of appointments) {
    const ref = appointment.participant?.find((p) => p.actor?.reference?.startsWith('Patient/'))?.actor?.reference;
    if (!ref) {
      continue;
    }
    const patient = byId.get(ref);
    const response = responses.find((r) => r.subject?.reference === ref);
    const task = tasks.find(
      (t) => t.for?.reference === ref && t.code?.coding?.[0]?.system === SYSTEM.barrier && t.code.coding[0].code !== 'recovery-off-track'
    );
    const benefits = eligibility.find((e) => e.patient?.reference === ref);
    preop.push({
      patientId: ref.split('/')[1],
      name: displayName(patient),
      procedure: appointment.description ?? '',
      start: appointment.start,
      readiness: (response ? (tagValue(response, SYSTEM.readiness) as Readiness) : 'unknown') ?? 'unknown',
      checks: response ? parseChecks(response) : [],
      barrier: task?.description,
      history: historyFor(ref),
      coverage: benefits
        ? {
            verified: benefits.outcome === 'complete',
            disposition: benefits.disposition ?? '',
            insurer: benefits.insurer?.display,
          }
        : undefined,
    });
  }
  preop.sort((a, b) => (a.start ?? '').localeCompare(b.start ?? ''));

  // ── Post-op ──
  const recovery: RecoveryCase[] = [];
  const reportsByPatient = new Map<string, DiagnosticReport[]>();
  for (const report of reports) {
    if (report.code?.coding?.[0]?.code !== 'recovery-report-24h') {
      continue;
    }
    const ref = report.subject?.reference;
    if (!ref) {
      continue;
    }
    reportsByPatient.set(ref, [...(reportsByPatient.get(ref) ?? []), report]);
  }

  for (const [ref, patientReports] of reportsByPatient) {
    const ordered = [...patientReports].sort((a, b) => (a.effectiveDateTime ?? '').localeCompare(b.effectiveDateTime ?? ''));
    const latest = ordered[ordered.length - 1];
    const patient = byId.get(ref);
    const procedure = procedures.find((p) => p.subject?.reference === ref);

    const resultsOf = (report: DiagnosticReport): Observation[] =>
      (report.result ?? []).flatMap((r) => {
        const obs = observations.find((o) => `Observation/${o.id}` === r.reference);
        return obs ? [obs] : [];
      });

    const history: RecoveryDay[] = [];
    ordered.forEach((report, index) => {
      const day = recoveryDayOf(report, resultsOf(report), index);
      if (day) {
        history.push(day);
      }
    });

    const latestObs = resultsOf(latest).find((o) => comp(o, 'asymmetry-index'));
    recovery.push({
      patientId: ref.split('/')[1],
      name: displayName(patient),
      procedure: procedure?.code?.text ?? 'Procedure',
      side: procedure?.bodySite?.[0]?.text ?? '',
      postOpDay: history[history.length - 1]?.postOpDay ?? 0,
      state: recoveryStateOf(latest),
      conclusion: latest.conclusion ?? '',
      issued: latest.issued,
      zones: latestObs ? parseZones(latestObs) : [],
      stanceMinutes: latestObs ? Math.round(num(latestObs, 'operated.stance') / 60) : 0,
      history,
      conditions: historyFor(ref),
    });
  }

  const severity: Record<RecoveryState, number> = { 'off-track': 0, watch: 1, 'insufficient-data': 2, 'on-track': 3 };
  recovery.sort((a, b) => severity[a.state] - severity[b.state] || a.name.localeCompare(b.name));

  return { preop, recovery };
}

function parseChecks(response: QuestionnaireResponse): PreopCheck[] {
  return CHECKS.map((id) => {
    const group = response.item?.find((i) => i.linkId === id);
    const utterance = group?.item?.find((i) => i.linkId === `${id}.utterance`)?.answer?.[0]?.valueString ?? '';
    const result = group?.item?.find((i) => i.linkId === `${id}.result`)?.answer?.[0]?.valueCoding?.code;
    return { id, result: (result as CheckResult) ?? 'confirmed', utterance };
  }).filter((c) => c.utterance !== '');
}

function parseZones(obs: Observation): ZoneReading[] {
  return ZONES.map((zone) => {
    const peak = comp(obs, `operated.${zone}.peak`);
    const range = peak?.referenceRange?.[0];
    return {
      zone,
      peakKpa: peak?.valueQuantity?.value ?? 0,
      bandLow: range?.low?.value ?? 0,
      bandHigh: range?.high?.value ?? 0,
      deviationSeconds: num(obs, `operated.${zone}.deviation`),
      contralateralKpa: num(obs, `contralateral.${zone}.peak`),
    };
  });
}

/** Where the operated foot sits inside its band: 0 = at the floor, 1 = at the ceiling. */
function loadIndexOf(obs: Observation): number {
  const values = ZONES.map((zone) => {
    const peak = comp(obs, `operated.${zone}.peak`);
    const range = peak?.referenceRange?.[0];
    const low = range?.low?.value ?? 0;
    const high = range?.high?.value ?? 1;
    const value = peak?.valueQuantity?.value ?? 0;
    return high === low ? 0 : (value - low) / (high - low);
  });
  return values.reduce((a, b) => a + b, 0) / values.length;
}

// ── Hook ──────────────────────────────────────────────────────────────

/**
 * One in-flight load shared by every caller.
 *
 * The shell and the page both want the board; without this they each fire seven
 * searches, and StrictMode doubles that again.
 */
let inFlight: Promise<Board> | undefined;

export function invalidateBoard(): void {
  inFlight = undefined;
}

export function useBoard(): { board?: Board; loading: boolean; error?: Error } {
  const medplum = useMedplum();
  const profile = useMedplumProfile();
  const [board, setBoard] = useState<Board>();
  const [error, setError] = useState<Error>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Searching while signed out 401s, and the client's onUnauthenticated handler
    // reloads the page — which mounts this hook again. That is an infinite refresh
    // loop, so the fetch must not start until there is a profile.
    if (!profile) {
      setLoading(false);
      return;
    }

    let live = true;
    setLoading(true);
    inFlight ??= loadBoard(medplum);
    inFlight
      .then((result) => live && setBoard(result))
      .catch((err) => {
        inFlight = undefined;
        if (live) {
          setError(err as Error);
        }
      })
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [medplum, profile]);

  return { board, loading, error };
}

export { getReferenceString };
export type { Appointment, Patient, Task };
