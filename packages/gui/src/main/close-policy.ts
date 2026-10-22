export type CloseDecision = 'close' | 'hide' | 'ask';

/**
 * What closing the main window does:
 * - nothing running in the app, or the app is quitting: close as usual
 * - templates running: hide to the tray so their forwards stay up
 * - on Linux, where not every desktop shows tray icons: ask instead of vanishing
 */
export function closeDecision(
  appRuns: number,
  quitting: boolean,
  platform: NodeJS.Platform
): CloseDecision {
  if (quitting || appRuns === 0) return 'close';
  return platform === 'linux' ? 'ask' : 'hide';
}
