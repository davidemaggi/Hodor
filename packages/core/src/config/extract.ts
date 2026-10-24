import * as path from 'path';
import {
  KubeConfigCluster,
  KubeConfigContext,
  KubeConfigFile,
  KubeConfigParser,
  KubeConfigUser,
} from './parser';

/** One context of one kubeconfig file */
export interface ContextRef {
  file: string;
  context: string;
}

export interface ExtractResult {
  /** The base (if any) plus the chosen contexts, their clusters and their users */
  config: KubeConfigFile;
  /** Entries that got a new name because another file used the same name for something else */
  renamed: Array<{ kind: 'cluster' | 'user' | 'context'; from: string; to: string; file: string }>;
  /** What happened to each chosen context, in order */
  contexts: Array<{
    from: ContextRef;
    /** Its name in the result */
    as: string;
    /** added: new · renamed: new, under another name · present: already there, identical */
    status: 'added' | 'renamed' | 'present';
  }>;
}

/** Fields holding file paths, which kubectl resolves against the kubeconfig's own folder */
const CLUSTER_PATHS = ['certificate-authority'];
const USER_PATHS = ['client-certificate', 'client-key', 'tokenFile'];

/**
 * Build a kubeconfig holding only `refs`, taken from `sources` (already parsed files), or add
 * them to `base` (a kubeconfig they're merged into: its entries keep their names and come first).
 *
 * - Clusters and users come along with the contexts that use them, once each.
 * - Two files may use the same name for different things: the later one is renamed (`name-2`)
 *   and its context follows. The same name with the same content is kept once.
 * - Relative file paths (certificates, keys, token files, exec commands) become absolute, so the
 *   result works wherever it's saved.
 * - The base's current context stays; without one, the first chosen context becomes current.
 */
export function extractContexts(
  sources: Map<string, KubeConfigFile>,
  refs: ContextRef[],
  base?: KubeConfigFile
): ExtractResult {
  if (refs.length === 0) throw new Error('No contexts chosen');

  const config: KubeConfigFile = {
    apiVersion: 'v1',
    kind: 'Config',
    preferences: {},
    ...base,
    clusters: [...(base?.clusters ?? [])],
    users: [...(base?.users ?? [])],
    contexts: [...(base?.contexts ?? [])],
  };
  const renamed: ExtractResult['renamed'] = [];
  const contexts: ExtractResult['contexts'] = [];
  const seen = new Set<string>();

  for (const ref of refs) {
    const key = `${ref.file}\u0000${ref.context}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const source = sources.get(ref.file);
    if (!source) throw new Error(`Kubeconfig not loaded: ${ref.file}`);
    const context = source.contexts?.find((c) => c.name === ref.context);
    if (!context) throw new Error(`Context '${ref.context}' isn't in ${ref.file}`);
    const cluster = source.clusters?.find((c) => c.name === context.context.cluster);
    if (!cluster) {
      throw new Error(
        `Context '${ref.context}' uses cluster '${context.context.cluster}', which ${ref.file} doesn't define`
      );
    }
    const user = source.users?.find((u) => u.name === context.context.user);
    if (!user) {
      throw new Error(
        `Context '${ref.context}' uses user '${context.context.user}', which ${ref.file} doesn't define`
      );
    }

    const dir = path.dirname(ref.file);
    const clusterName = place<KubeConfigCluster>(
      config.clusters,
      'cluster',
      cluster.name,
      absolutize(cluster.cluster, dir, CLUSTER_PATHS) as KubeConfigCluster['cluster'],
      ref.file,
      renamed
    );
    const userName = place<KubeConfigUser>(
      config.users,
      'user',
      user.name,
      absolutizeUser(user.user, dir),
      ref.file,
      renamed
    );
    const before = config.contexts.length;
    const as = place<KubeConfigContext>(
      config.contexts,
      'context',
      context.name,
      { ...context.context, cluster: clusterName, user: userName },
      ref.file,
      renamed
    );
    contexts.push({
      from: ref,
      as,
      status:
        config.contexts.length === before ? 'present' : as === context.name ? 'added' : 'renamed',
    });
  }

  if (!config['current-context']) {
    config['current-context'] = contexts.find((c) => c.status !== 'present')?.as ?? contexts[0]?.as;
  }
  return { config, renamed, contexts };
}

/** extractContexts() reading the files itself */
export async function extractContextsFromFiles(
  refs: ContextRef[],
  parser = new KubeConfigParser(),
  base?: KubeConfigFile
): Promise<ExtractResult> {
  const sources = new Map<string, KubeConfigFile>();
  for (const file of new Set(refs.map((r) => r.file))) {
    sources.set(file, await parser.parseFile(file));
  }
  return extractContexts(sources, refs, base);
}

type Entry = KubeConfigCluster | KubeConfigUser | KubeConfigContext;
const FIELD = { cluster: 'cluster', user: 'user', context: 'context' } as const;

/** Add an entry under its name, or a free variant of it; returns the name it ended up with */
function place<T extends Entry>(
  list: T[],
  kind: 'cluster' | 'user' | 'context',
  name: string,
  value: unknown,
  file: string,
  renamed: ExtractResult['renamed']
): string {
  const field = FIELD[kind];
  for (let i = 1; ; i++) {
    const candidate = i === 1 ? name : `${name}-${i}`;
    const existing = list.find((e) => e.name === candidate) as Record<string, unknown> | undefined;
    if (!existing) {
      list.push({ name: candidate, [field]: value } as unknown as T);
      if (candidate !== name) renamed.push({ kind, from: name, to: candidate, file });
      return candidate;
    }
    if (stableJson(existing[field]) === stableJson(value)) return candidate;
  }
}

function absolutize(
  values: Record<string, unknown>,
  dir: string,
  keys: string[]
): Record<string, unknown> {
  const out = { ...values };
  for (const key of keys) {
    const value = out[key];
    if (typeof value === 'string' && value && !path.isAbsolute(value)) {
      out[key] = path.resolve(dir, value);
    }
  }
  return out;
}

function absolutizeUser(user: Record<string, unknown>, dir: string): Record<string, unknown> {
  const out = absolutize(user, dir, USER_PATHS);
  const exec = out.exec as Record<string, unknown> | undefined;
  // kubectl resolves an exec command against the kubeconfig's folder only when it's a path
  if (
    exec &&
    typeof exec.command === 'string' &&
    /[\\/]/.test(exec.command) &&
    !path.isAbsolute(exec.command)
  ) {
    out.exec = { ...exec, command: path.resolve(dir, exec.command) };
  }
  return out;
}

/** JSON with sorted keys, to compare two entries by content */
function stableJson(value: unknown): string {
  return JSON.stringify(value, (_key, v) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)))
      : v
  );
}
