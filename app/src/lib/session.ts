import { MedplumClient } from '@medplum/core';

/**
 * The Medplum session.
 *
 * There is no sign-in screen: the app authenticates itself with the project's
 * ClientApplication before first render. When that fails the app must say so — a silent
 * auth failure previously surfaced as "Patient not found" on every page, which points
 * the reader at the data instead of at the connection.
 */

export const medplum = new MedplumClient({
  // Not redirecting on 401: there is no sign-in page to redirect to, and a redirect here
  // is what turned an auth failure into an infinite reload.
  onUnauthenticated: () => console.error('Medplum session is not authenticated.'),
  cacheTime: 3000,
  baseUrl: import.meta.env.MEDPLUM_BASE_URL,
});

let authError: string | undefined;

export function getAuthError(): string | undefined {
  return authError;
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** Medplum reports how long the rate limiter wants us to wait; it is embedded in the message. */
function retryAfterMs(message: string): number | undefined {
  const match = /"_msBeforeNext":(\d+)/.exec(message);
  return match ? Number(match[1]) : undefined;
}

/**
 * Reuse the token from a previous page load.
 *
 * This is the important half. Medplum rate-limits token grants, and a page that performs
 * a fresh client-credentials grant on every load will exhaust that limit during any
 * session involving reloads — which is every development session and every demo where
 * someone hits refresh. The token is persisted by the client, so most loads should cost
 * no grant at all.
 */
async function reuseExistingSession(): Promise<boolean> {
  if (!medplum.getAccessToken()) {
    return false;
  }
  try {
    await medplum.getProfileAsync();
    return Boolean(medplum.getProfile());
  } catch {
    return false;
  }
}

export async function connect(): Promise<boolean> {
  const clientId = import.meta.env.MEDPLUM_CLIENT_ID;
  const clientSecret = import.meta.env.MEDPLUM_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    authError = 'MEDPLUM_CLIENT_ID and MEDPLUM_CLIENT_SECRET are not set in app/.env.';
    console.error(authError);
    return false;
  }

  if (await reuseExistingSession()) {
    authError = undefined;
    return true;
  }

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await medplum.startClientLogin(clientId, clientSecret);
      authError = undefined;
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const waitMs = retryAfterMs(message);

      // A short cooldown is worth waiting out inline; a long one belongs on screen with a
      // retry button rather than a frozen page.
      if (waitMs !== undefined && attempt === 0 && waitMs <= 3000) {
        await sleep(waitMs + 250);
        continue;
      }

      authError = /429|too many/i.test(message)
        ? `Medplum rate-limited the sign-in — too many grants from repeated reloads.${
            waitMs ? ` Try again in about ${Math.ceil(waitMs / 1000)}s.` : ' Try again shortly.'
          }`
        : message;
      console.error('Medplum client login failed:', err);
      return false;
    }
  }
  return false;
}
