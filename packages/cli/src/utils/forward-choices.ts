import type { PodView, ServiceView } from '@hodor/core';

/** What a forward can point at, as the pickers show it */
export interface Target {
  type: 'service' | 'deployment' | 'pod';
  name: string;
  /** Ports to forward to: a service's own ports, or a pod's container ports */
  ports: Array<{ port: number; label: string }>;
}

// eslint-disable-next-line no-control-regex
const ANSI = /\x1b\[[0-9;]*m/g;

/** Every word of the search term appears in the text, in any order and case */
export function matches(text: string, term: string | undefined): boolean {
  const haystack = text.replace(ANSI, '').toLowerCase();
  return (term ?? '')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => haystack.includes(word));
}

export function filterChoices<T extends { name: string; description?: string }>(
  choices: T[],
  term: string | undefined
): T[] {
  return choices.filter((c) => matches(`${c.name} ${c.description ?? ''}`, term));
}

/** A pod owned by a ReplicaSet belongs to a Deployment (same rule as the app's template editor) */
function deploymentOf(pod: PodView): string | undefined {
  const [kind, owner] = pod.owner?.split('/') ?? [];
  return kind === 'ReplicaSet' && owner ? owner.replace(/-[a-z0-9]{5,10}$/, '') : undefined;
}

/**
 * Services first, then Deployments, then the pods nothing else owns: forwards to the first two
 * outlive their pods. Services without a selector are left out (nothing behind them to forward
 * to), and so are pods that aren't running.
 */
export function targetsOf(services: ServiceView[], pods: PodView[]): Target[] {
  const deployments = new Map<string, Target>();
  const loose: Target[] = [];
  for (const pod of pods.filter((p) => p.status === 'Running')) {
    const ports = pod.ports
      .filter((c) => c.protocol === 'TCP')
      .map((c) => ({ port: c.port, label: [c.name, c.container].filter(Boolean).join(' · ') }));
    const deployment = deploymentOf(pod);
    if (!deployment) {
      loose.push({ type: 'pod', name: pod.name, ports });
      continue;
    }
    // Its replicas share the ports; a rollout in progress may add some
    const target = deployments.get(deployment) ?? {
      type: 'deployment',
      name: deployment,
      ports: [],
    };
    for (const p of ports) if (!target.ports.some((q) => q.port === p.port)) target.ports.push(p);
    deployments.set(deployment, target);
  }
  return [
    ...services
      .filter((s) => s.forwardable)
      .map<Target>((s) => ({
        type: 'service',
        name: s.name,
        ports: s.ports
          .filter((p) => p.protocol === 'TCP')
          .map((p) => ({
            port: p.port,
            label: [p.name, p.targetPort !== p.port ? `→ ${p.targetPort}` : '']
              .filter(Boolean)
              .join(' '),
          })),
      })),
    ...[...deployments.values()].sort((a, b) => a.name.localeCompare(b.name)),
    ...loose,
  ];
}

/** The ports of a target as one short line: "80, 443" */
export function portsSummary(target: Target): string {
  return target.ports.map((p) => p.port).join(', ');
}

/**
 * A forward name nobody else in the template uses: the resource's name, plus the port when the
 * resource has several, plus a counter if that's taken too.
 */
export function suggestForwardName(target: Target, port: number, taken: string[]): string {
  const base = target.ports.length > 1 ? `${target.name}-${port}` : target.name;
  let name = base;
  for (let i = 2; taken.includes(name); i++) name = `${base}-${i}`;
  return name;
}
