import type { Device, DiagnosticReport, Observation, ObservationComponent, Patient, Procedure, Task } from '@medplum/fhirtypes';
import { medplum, seedId, upsert } from '../client.js';
import { SYSTEM } from '../systems.js';
import { COHORT, historyDays, sessionFor, type CohortPatient } from './cohort.js';
import {
  RECOVERY_DISPLAY,
  ZONE_LABEL,
  assess,
  expectedAsymmetry,
  expectedBand,
  type FootSession,
  type RecoveryAssessment,
} from './zones.js';

/** Midnight `n` days ago, local. Sessions are daily, so time of day carries no meaning. */
function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(20, 0, 0, 0);
  return d;
}

function footComponents(foot: FootSession, side: 'operated' | 'contralateral', postOpDay: number): ObservationComponent[] {
  const components: ObservationComponent[] = [
    {
      code: { coding: [{ system: SYSTEM.zone, code: `${side}.stance` }], text: `${side} stance time` },
      valueQuantity: { value: foot.stanceSeconds, unit: 's', system: 'http://unitsofmeasure.org', code: 's' },
    },
  ];

  for (const reading of foot.readings) {
    const band = expectedBand(reading.zone, postOpDay);
    components.push({
      code: {
        coding: [{ system: SYSTEM.zone, code: `${side}.${reading.zone}.peak` }],
        text: `${ZONE_LABEL[reading.zone]} peak pressure (${side})`,
      },
      valueQuantity: { value: reading.peakKpa, unit: 'kPa', system: 'http://unitsofmeasure.org', code: 'kPa' },
      // The expected band travels with the measurement so the UI never recomputes it.
      referenceRange: [
        {
          low: { value: Math.round(band.min), unit: 'kPa' },
          high: { value: Math.round(band.max), unit: 'kPa' },
          text: `Post-op day ${postOpDay} weight-bearing band`,
        },
      ],
    });
    if (side === 'operated') {
      components.push({
        code: {
          coding: [{ system: SYSTEM.zone, code: `operated.${reading.zone}.deviation` }],
          text: `${ZONE_LABEL[reading.zone]} time outside band`,
        },
        valueQuantity: { value: reading.deviationSeconds, unit: 's', system: 'http://unitsofmeasure.org', code: 's' },
      });
    }
  }
  return components;
}

/** The prose a clinician actually reads. Assembled from the assessment, not generated. */
function conclusion(patient: CohortPatient, a: RecoveryAssessment): string {
  const head = `Post-op day ${a.postOpDay}, ${patient.procedureDisplay.toLowerCase()}, ${patient.side} side. ${RECOVERY_DISPLAY[a.state]}.`;
  const metrics = `Load asymmetry ${Math.round(a.asymmetryIndex * 100)}% against ${Math.round(expectedAsymmetry(a.postOpDay) * 100)}% expected on the ${a.stage.toLowerCase()} weight-bearing stage.`;
  // The reasons already quantify stance time when it matters — repeating it here reads
  // like the report is padding.
  return [head, metrics, ...a.reasons].join(' ');
}

async function seedPatient(patient: CohortPatient): Promise<string> {
  const fhirPatient = await upsert<Patient>(
    {
      resourceType: 'Patient',
      identifier: seedId(patient.key),
      name: [{ given: [patient.given], family: patient.family }],
      birthDate: patient.birthDate,
      telecom: [{ system: 'phone', value: patient.phone, use: 'mobile' }],
    },
    patient.key
  );
  const patientRef = { reference: `Patient/${fhirPatient.id}` };

  await upsert<Procedure>(
    {
      resourceType: 'Procedure',
      identifier: seedId(`${patient.key}-procedure`),
      status: 'completed',
      subject: patientRef,
      performedDateTime: daysAgo(patient.postOpDay).toISOString(),
      code: {
        coding: [{ system: SYSTEM.procedure, code: patient.procedure, display: patient.procedureDisplay }],
        text: patient.procedureDisplay,
      },
      bodySite: [{ text: `${patient.side} foot` }],
    },
    `${patient.key}-procedure`
  );

  const device = await upsert<Device>(
    {
      resourceType: 'Device',
      identifier: seedId(`${patient.key}-insole`),
      status: 'active',
      patient: patientRef,
      serialNumber: patient.serial,
      deviceName: [{ name: 'SurgeryReady pressure insole', type: 'model-name' }],
      type: { text: 'Plantar pressure sensing insole' },
    },
    `${patient.key}-insole`
  );

  let previous: RecoveryAssessment | undefined;
  let latest: RecoveryAssessment | undefined;

  for (const day of historyDays(patient)) {
    const session = sessionFor(patient, day);
    const assessment = assess(session, previous);
    const when = daysAgo(patient.postOpDay - day).toISOString();

    const observation = await upsert<Observation>(
      {
        resourceType: 'Observation',
        identifier: seedId(`${patient.key}-session-${day}`),
        status: 'final',
        category: [
          {
            coding: [
              { system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'activity', display: 'Activity' },
            ],
          },
        ],
        code: {
          coding: [{ system: SYSTEM.measurement, code: 'plantar-pressure-session' }],
          text: 'Plantar pressure session',
        },
        subject: patientRef,
        device: { reference: `Device/${device.id}` },
        effectiveDateTime: when,
        component: [
          ...footComponents(session.operated, 'operated', day),
          ...footComponents(session.contralateral, 'contralateral', day),
          {
            code: { coding: [{ system: SYSTEM.measurement, code: 'post-op-day' }], text: 'Post-operative day' },
            valueInteger: day,
          },
          {
            code: { coding: [{ system: SYSTEM.measurement, code: 'asymmetry-index' }], text: 'Load asymmetry index' },
            valueQuantity: { value: Math.round(assessment.asymmetryIndex * 1000) / 1000, unit: 'ratio' },
          },
          {
            code: {
              coding: [{ system: SYSTEM.measurement, code: 'expected-asymmetry' }],
              text: 'Expected asymmetry for this post-op day',
            },
            valueQuantity: { value: Math.round(expectedAsymmetry(day) * 1000) / 1000, unit: 'ratio' },
          },
        ],
      },
      `${patient.key}-session-${day}`
    );

    await upsert<DiagnosticReport>(
      {
        resourceType: 'DiagnosticReport',
        identifier: seedId(`${patient.key}-report-${day}`),
        status: 'final',
        code: {
          coding: [{ system: SYSTEM.measurement, code: 'recovery-report-24h' }],
          text: '24-hour recovery report',
        },
        subject: patientRef,
        effectiveDateTime: when,
        issued: when,
        result: [{ reference: `Observation/${observation.id}` }],
        conclusion: conclusion(patient, assessment),
        conclusionCode: [
          {
            coding: [
              { system: SYSTEM.recoveryState, code: assessment.state, display: RECOVERY_DISPLAY[assessment.state] },
            ],
          },
        ],
      },
      `${patient.key}-report-${day}`
    );

    previous = assessment;
    latest = assessment;
  }

  // The task tracks the *current* state, so it has to close when the patient recovers.
  // Leaving a resolved escalation open is how a queue stops being worth reading.
  const taskKey = `${patient.key}-recovery-task`;
  const existingTask = await medplum.searchOne('Task', `identifier=${encodeURIComponent(`${SYSTEM.seed}|${taskKey}`)}`);
  if (latest && (latest.state === 'off-track' || existingTask)) {
    const open = latest.state === 'off-track';
    await upsert<Task>(
      {
        resourceType: 'Task',
        identifier: seedId(taskKey),
        status: open ? 'requested' : 'completed',
        intent: 'order',
        priority: 'urgent',
        description: open ? latest.reasons[0] : `Resolved — recovery ${RECOVERY_DISPLAY[latest.state].toLowerCase()} at day ${latest.postOpDay}.`,
        for: patientRef,
        authoredOn: new Date().toISOString(),
        code: {
          coding: [{ system: SYSTEM.barrier, code: 'recovery-off-track' }],
          text: `Recovery off track — post-op day ${latest.postOpDay}`,
        },
      },
      taskKey
    );
  }

  const name = `${patient.given} ${patient.family}`;
  return `  POD ${String(latest?.postOpDay ?? 0).padStart(2)}  ${name.padEnd(16)} ${patient.procedureDisplay.padEnd(26)} ${RECOVERY_DISPLAY[latest?.state ?? 'insufficient-data']}`;
}

export async function seedRecovery(): Promise<void> {
  for (const patient of COHORT) {
    console.log(await seedPatient(patient));
  }
}
