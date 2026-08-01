import { ClientStorage, MedplumClient, MemoryStorage } from '@medplum/core';
import type { Identifier, Resource } from '@medplum/fhirtypes';
import { config } from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SYSTEM } from './systems.js';

config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../../server/.env') });

const { MEDPLUM_BASE_URL, MEDPLUM_CLIENT_ID, MEDPLUM_CLIENT_SECRET } = process.env;

if (!MEDPLUM_CLIENT_ID || !MEDPLUM_CLIENT_SECRET) {
  console.error('Missing MEDPLUM_CLIENT_ID / MEDPLUM_CLIENT_SECRET in server/.env');
  process.exit(1);
}

/*
 * `storage` must be explicit off the browser. MedplumClient defaults to
 * `window.localStorage` when a global of that name exists, and Node 20+ defines one that
 * throws unless the process was started with --localstorage-file. Without this the client
 * dies in its constructor on getActiveLogin.
 *
 * Note the two layers: the client wants an IClientStorage (getObject/setString), which is
 * ClientStorage; MemoryStorage is the plain key-value Storage it wraps.
 */
export const medplum = new MedplumClient({
  baseUrl: MEDPLUM_BASE_URL ?? 'https://api.medplum.com/',
  storage: new ClientStorage(new MemoryStorage()),
});

export async function login(): Promise<void> {
  await medplum.startClientLogin(MEDPLUM_CLIENT_ID as string, MEDPLUM_CLIENT_SECRET as string);
}

/** Identifier list every seeded resource carries, so seeding is idempotent. */
export const seedId = (key: string): Identifier[] => [{ system: SYSTEM.seed, value: key }];

/**
 * Conditional update keyed on the seed identifier: creates on first run, overwrites
 * afterwards. Fixture edits therefore reach the server — a plain conditional *create*
 * would return the stale resource and silently drop the change.
 */
export async function upsert<T extends Resource>(resource: T, key: string): Promise<T> {
  return medplum.upsertResource<T>(resource, `identifier=${encodeURIComponent(`${SYSTEM.seed}|${key}`)}`);
}
