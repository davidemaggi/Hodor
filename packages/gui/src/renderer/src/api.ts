import type { HodorApi } from '../../shared/api';

/**
 * The real API comes from the preload bridge. The fixture API exists only in the
 * browser preview used for design reviews (`pnpm preview:web`) and is dropped from real builds.
 */
async function resolveApi(): Promise<HodorApi> {
  if (window.hodor) return window.hodor;
  if (import.meta.env.MODE === 'fixtures') {
    return (await import('./fixtures')).fixtureApi;
  }
  throw new Error('Hodor API bridge is missing');
}

export const api: HodorApi = await resolveApi();

/** Electron prefixes errors from the main process; keep only the useful part */
export function errorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  // "Error invoking remote method 'x': KubernetesApiError: Failed…" → "Failed…"
  return message
    .replace(/^Error invoking remote method '[^']+': /, '')
    .replace(/^(\w*Error: )+/, '');
}
