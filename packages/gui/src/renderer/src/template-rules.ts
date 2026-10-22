import type { PortForwardConfig } from '@hodor/core';
import type { TemplateSummary } from '../../shared/api';

// Mirrors suggestLocalPort/findPortConflicts in @hodor/core (templates/schema.ts). The renderer can't import
// the core bundle (it pulls in Node modules), so these small pure rules are repeated here for instant feedback;
// the main process validates again on save.

export function suggestLocalPort(remotePort: number, taken: Iterable<number> = []): number {
  const used = new Set(taken);
  let candidate = remotePort + 10000 <= 65535 ? remotePort + 10000 : remotePort;
  if (candidate < 1024) candidate += 10000;
  while (used.has(candidate) && candidate < 65535) candidate++;
  return candidate;
}

export const isPort = (n: number) => Number.isInteger(n) && n >= 1 && n <= 65535;
export const isDnsLabel = (s: string) =>
  /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/.test(s) && s.length <= 63;
export const isResourceName = (s: string) =>
  /^[a-z0-9]([-.a-z0-9]*[a-z0-9])?$/.test(s) && s.length <= 253;

export interface ForwardIssues {
  localPort?: 'invalid' | 'duplicate' | 'privileged';
  remotePort?: 'invalid';
  name?: 'missing' | 'duplicate';
  namespace?: 'invalid';
  resourceName?: 'invalid';
}

/** Per-forward problems that block saving (privileged ports only warn) */
export function forwardIssues(forwards: PortForwardConfig[]): ForwardIssues[] {
  const portCount = new Map<number, number>();
  const nameCount = new Map<string, number>();
  forwards.forEach((f) => {
    portCount.set(f.localPort, (portCount.get(f.localPort) ?? 0) + 1);
    nameCount.set(f.name.trim(), (nameCount.get(f.name.trim()) ?? 0) + 1);
  });
  return forwards.map((f) => {
    const issues: ForwardIssues = {};
    if (!isPort(f.localPort)) issues.localPort = 'invalid';
    else if ((portCount.get(f.localPort) ?? 0) > 1) issues.localPort = 'duplicate';
    else if (f.localPort < 1024) issues.localPort = 'privileged';
    if (!isPort(f.remotePort)) issues.remotePort = 'invalid';
    if (!f.name.trim()) issues.name = 'missing';
    else if ((nameCount.get(f.name.trim()) ?? 0) > 1) issues.name = 'duplicate';
    if (!isDnsLabel(f.namespace)) issues.namespace = 'invalid';
    if (!isResourceName(f.resourceName)) issues.resourceName = 'invalid';
    return issues;
  });
}

export const blocking = (i: ForwardIssues) =>
  !!(
    i.remotePort ||
    i.name ||
    i.namespace ||
    i.resourceName ||
    (i.localPort && i.localPort !== 'privileged')
  );

/** Other templates that use one of these local ports: they can't run at the same time */
export function portConflicts(forwards: PortForwardConfig[], others: TemplateSummary[]) {
  const mine = new Set(forwards.map((f) => f.localPort));
  return others.flatMap((t) =>
    t.forwards
      .filter((f) => mine.has(f.localPort))
      .map((f) => ({ port: f.localPort, template: t.name }))
  );
}
