import { config } from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../.env') });

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing ${name} in server/.env`);
    process.exit(1);
  }
  return value;
}

export const CONFIG = {
  port: Number(process.env.PORT ?? 8080),
  deepgramKey: required('DEEPGRAM_API_KEY'),
  moss: {
    projectId: process.env.MOSS_PROJECT_ID ?? '',
    projectKey: process.env.MOSS_PROJECT_KEY ?? '',
  },
  medplum: {
    baseUrl: process.env.MEDPLUM_BASE_URL ?? 'https://api.medplum.com/',
    clientId: required('MEDPLUM_CLIENT_ID'),
    clientSecret: required('MEDPLUM_CLIENT_SECRET'),
  },
};

/** Deepgram Voice Agent socket. Verified against a live connect, not taken from docs. */
export const DEEPGRAM_AGENT_URL = 'wss://agent.deepgram.com/v1/agent/converse';

/** Browser mic feeds us 16 kHz PCM; the agent speaks back at 24 kHz. */
export const AUDIO = { inputRate: 16000, outputRate: 24000 } as const;
