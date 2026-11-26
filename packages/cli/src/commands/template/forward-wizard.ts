import chalk from 'chalk';
import ora from 'ora';
import {
  ClusterDiscovery,
  ResourceBrowser,
  suggestLocalPort,
  validatePort,
  validateResourceName,
  withTimeout,
} from '@hodor/core';
import type { PortForwardConfig } from '@hodor/core';
import { prompt, searchSelect, type SearchChoice } from '../../utils/prompt.js';
import { clusterLabel, openSettings } from '../../utils/shared.js';
import {
  portsSummary,
  suggestForwardName,
  targetsOf,
  type Target,
} from '../../utils/forward-choices.js';
import { t } from '../../i18n.js';

/**
 * One template being created or edited: the cluster browsed for names (asked once) and the
 * local ports its forwards already use. Templates stay cluster-agnostic: only names are kept.
 */
export interface ForwardSession {
  /** undefined: not asked yet · null: names are typed by hand */
  browser?: ResourceBrowser | null;
  namespaces?: string[];
  contextNamespace?: string;
  takenPorts: number[];
}

export function newForwardSession(takenPorts: number[] = []): ForwardSession {
  return { takenPorts };
}

const TYPE = '\u0000type';
const SHORT: Record<Target['type'], string> = { service: 'svc', deployment: 'deploy', pod: 'pod' };
const KIND: Record<Target['type'], (text: string) => string> = {
  service: chalk.cyan,
  deployment: chalk.blue,
  pod: chalk.magenta,
};
const typeItMyself = <T>(): SearchChoice<T> => ({
  name: chalk.dim(t('templates.forward.typeIt')),
  value: TYPE as T,
});

/** Ask once which cluster to look names up in; null when the user would rather type */
async function browserFor(session: ForwardSession): Promise<ResourceBrowser | null> {
  if (session.browser !== undefined) return session.browser;
  session.browser = null;

  const discovery = new ClusterDiscovery();
  const clusters = await discovery.list();
  if (clusters.length === 0) return null;

  const settings = await openSettings();
  const lastUsed = settings.get('lastUsedCluster');
  const first = clusters.find((c) => c.id === lastUsed) ?? clusters.find((c) => c.isDefault);
  const ordered = first ? [first, ...clusters.filter((c) => c !== first)] : clusters;
  const showSource = new Set(clusters.map((c) => c.sourceFile)).size > 1;

  const id = await searchSelect<string>(
    t('templates.forward.pickCluster'),
    ordered.map((c) => ({ name: clusterLabel(c, showSource), value: c.id, short: c.name })),
    { pinned: [{ name: chalk.dim(t('templates.forward.typeEverything')), value: TYPE }] }
  );
  if (id === TYPE) return null;
  await settings.set('lastUsedCluster', id);
  const cluster = clusters.find((c) => c.id === id)!;

  const spinner = ora(t('templates.forward.connecting', { cluster: cluster.name })).start();
  try {
    const browser = new ResourceBrowser(
      await discovery.connect(cluster),
      cluster.namespace || 'default'
    );
    // A cluster behind a VPN that's off would otherwise keep us waiting for minutes
    const { namespaces } = await withTimeout(browser.namespaces(), 8000);
    spinner.stop();
    session.browser = browser;
    session.namespaces = namespaces;
    session.contextNamespace = cluster.namespace || 'default';
  } catch (error) {
    spinner.warn(
      t('templates.forward.unreachable', { cluster: cluster.name, error: (error as Error).message })
    );
  }
  return session.browser;
}

/**
 * One forward. With a cluster to look at, namespace, service or pod and port are picked from
 * lists you can filter by typing; otherwise (or when "type it myself" is picked) they're typed.
 */
export async function promptForForward(
  existingNames: string[],
  current?: PortForwardConfig,
  session: ForwardSession = newForwardSession()
): Promise<PortForwardConfig> {
  const browser = await browserFor(session);
  const forward = browser
    ? await pickForward(browser, session, existingNames, current)
    : await typeForward(existingNames, current);
  session.takenPorts.push(forward.localPort);
  return forward;
}

async function pickForward(
  browser: ResourceBrowser,
  session: ForwardSession,
  existingNames: string[],
  current?: PortForwardConfig
): Promise<PortForwardConfig> {
  // Namespace: the forward's own first when editing, then the context's
  const preferred = current?.namespace ?? session.contextNamespace;
  const namespaces = session.namespaces ?? [];
  const nsOrdered =
    preferred && namespaces.includes(preferred)
      ? [preferred, ...namespaces.filter((n) => n !== preferred)]
      : namespaces;
  let namespace = await searchSelect<string>(
    t('templates.forward.pickNamespace'),
    nsOrdered.map((n) => ({ name: n, value: n })),
    { pinned: [typeItMyself<string>()] }
  );
  if (namespace === TYPE) {
    ({ namespace } = await prompt<{ namespace: string }>([
      {
        type: 'input',
        name: 'namespace',
        message: t('templates.forward.namespace'),
        default: preferred,
        validate: (input: string) =>
          validateResourceName(input.trim()) || t('templates.forward.namespaceInvalid'),
        filter: (input: string) => input.trim(),
      },
    ]));
  }

  const spinner = ora(t('templates.forward.loading', { namespace })).start();
  let targets: Target[];
  try {
    const [services, pods] = await Promise.all([
      browser.services(namespace),
      browser.pods(namespace),
    ]);
    targets = targetsOf(services, pods);
    spinner.stop();
  } catch (error) {
    spinner.warn(t('templates.forward.listFailed', { namespace, error: (error as Error).message }));
    return typeForward(existingNames, { ...current, namespace });
  }
  if (targets.length === 0) {
    console.log(chalk.yellow(`  ${t('templates.forward.nothingHere', { namespace })}`));
    return typeForward(existingNames, { ...current, namespace });
  }

  // The forward's own resource first when editing
  const isCurrent = (x: Target) =>
    x.type === current?.resourceType && x.name === current?.resourceName;
  const ordered = [...targets.filter(isCurrent), ...targets.filter((x) => !isCurrent(x))];
  const target = await searchSelect<Target | typeof TYPE>(
    t('templates.forward.pickTarget', { namespace }),
    ordered.map((x) => ({
      name: `${KIND[x.type](SHORT[x.type].padEnd(6))} ${x.name}${chalk.dim(`  ${portsSummary(x)}`)}`,
      value: x,
      short: `${SHORT[x.type]} ${x.name}`,
    })),
    { pinned: [typeItMyself<Target | typeof TYPE>()] }
  );
  if (target === TYPE) return typeForward(existingNames, { ...current, namespace });

  // Port: picked when there are several, taken as is when there's one, typed when none is declared
  const OTHER = -1;
  let remotePort: number;
  if (target.ports.length === 1) {
    remotePort = target.ports[0].port;
    console.log(chalk.dim(`  ${t('templates.forward.onlyPort', { port: remotePort })}`));
  } else {
    remotePort = OTHER;
    if (target.ports.length > 1) {
      ({ remotePort } = await prompt<{ remotePort: number }>([
        {
          type: 'list',
          name: 'remotePort',
          message: t('templates.forward.pickPort'),
          choices: [
            ...target.ports.map((p) => ({
              name: `${p.port}${p.label ? chalk.dim(`  ${p.label}`) : ''}`,
              value: p.port,
              short: String(p.port),
            })),
            { name: chalk.dim(t('templates.forward.otherPort')), value: OTHER },
          ],
          default: target.ports.findIndex((p) => p.port === current?.remotePort),
        },
      ]));
    }
    if (remotePort === OTHER) {
      ({ remotePort } = await prompt<{ remotePort: number }>([
        {
          type: 'number',
          name: 'remotePort',
          message: t('templates.forward.remotePort'),
          default: current?.remotePort,
          validate: (input: number) => validatePort(input) || t('templates.forward.portRange'),
        },
      ]));
    }
  }

  const sameTarget = isCurrent(target) && current?.remotePort === remotePort;
  const answers = await prompt<{ name: string; localPort: number }>([
    {
      type: 'input',
      name: 'name',
      message: t('templates.forward.name'),
      default: sameTarget ? current?.name : suggestForwardName(target, remotePort, existingNames),
      validate: (input: string) =>
        !input.trim()
          ? t('templates.forward.nameRequired')
          : existingNames.includes(input.trim())
            ? t('templates.forward.nameExists', { name: input.trim() })
            : true,
      filter: (input: string) => input.trim(),
    },
    {
      type: 'number',
      name: 'localPort',
      message: t('templates.forward.localPort'),
      default: sameTarget ? current?.localPort : suggestLocalPort(remotePort, session.takenPorts),
      validate: (input: number) => validatePort(input) || t('templates.forward.portRange'),
    },
  ]);

  const { secrets, configMaps } = await pickLinked(browser, namespace, current);
  return {
    name: answers.name,
    namespace,
    resourceType: target.type,
    resourceName: target.name,
    localPort: answers.localPort,
    remotePort,
    ...(secrets.length ? { secrets } : {}),
    ...(configMaps.length ? { configMaps } : {}),
  };
}

/** Secrets and config maps to read while the forward runs, ticked from the namespace's own */
async function pickLinked(
  browser: ResourceBrowser,
  namespace: string,
  current?: PortForwardConfig
): Promise<{ secrets: string[]; configMaps: string[] }> {
  let names: Awaited<ReturnType<ResourceBrowser['linkables']>>;
  try {
    names = await browser.linkables(namespace);
  } catch {
    names = { secrets: null, configMaps: null };
  }
  const pick = async (
    kind: 'secrets' | 'configMaps',
    available: string[] | null,
    chosen: string[] = []
  ): Promise<string[]> => {
    if (available && available.length === 0) return [];
    if (!available) {
      // Not allowed to list them: names can still be typed
      const { typed } = await prompt<{ typed: string }>([
        {
          type: 'input',
          name: 'typed',
          message: t(`templates.forward.${kind}Typed`),
          default: chosen.join(', '),
        },
      ]);
      return typed
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    }
    const { picked } = await prompt<{ picked: string[] }>([
      {
        type: 'checkbox',
        name: 'picked',
        message: `${t(`templates.forward.${kind}Pick`)} ${chalk.dim(t('templates.forward.optionalHint'))}`,
        pageSize: 12,
        choices: available.map((n) => ({ name: n, value: n, checked: chosen.includes(n) })),
      },
    ]);
    return picked;
  };
  return {
    secrets: await pick('secrets', names.secrets, current?.secrets),
    configMaps: await pick('configMaps', names.configMaps, current?.configMaps),
  };
}

/**
 * Typed by hand, as before: no cluster at hand, or "type it myself"
 */
async function typeForward(
  existingNames: string[],
  current?: Partial<PortForwardConfig>
): Promise<PortForwardConfig> {
  const answers = await prompt<{
    name: string;
    namespace: string;
    resourceType: 'pod' | 'service' | 'deployment';
    resourceName: string;
    localPort: number;
    remotePort: number;
    addSecrets: boolean;
    secrets?: string;
    addConfigMaps: boolean;
    configMaps?: string;
  }>([
    {
      type: 'input',
      name: 'name',
      message: t('templates.forward.name'),
      default: current?.name,
      validate: (input: string) => {
        if (!input || input.trim().length === 0) {
          return t('templates.forward.nameRequired');
        }
        if (existingNames.includes(input)) {
          return t('templates.forward.nameExists', { name: input });
        }
        return true;
      },
    },
    {
      type: 'input',
      name: 'namespace',
      message: t('templates.forward.namespace'),
      default: current?.namespace || 'default',
      validate: (input: string) => {
        if (!input || input.trim().length === 0) {
          return t('templates.forward.namespaceRequired');
        }
        if (!validateResourceName(input)) {
          return t('templates.forward.namespaceInvalid');
        }
        return true;
      },
    },
    {
      type: 'list',
      name: 'resourceType',
      message: t('templates.forward.resourceType'),
      choices: [
        { name: 'Service', value: 'service' },
        { name: 'Deployment', value: 'deployment' },
        { name: 'Pod', value: 'pod' },
      ],
      default: current?.resourceType || 'service',
    },
    {
      type: 'input',
      name: 'resourceName',
      message: t('templates.forward.resourceName'),
      default: current?.resourceName,
      validate: (input: string) => {
        if (!input || input.trim().length === 0) {
          return t('templates.forward.resourceNameRequired');
        }
        return true;
      },
    },
    {
      type: 'number',
      name: 'localPort',
      message: t('templates.forward.localPort'),
      default: current?.localPort,
      validate: (input: number) => {
        if (!validatePort(input)) {
          return t('templates.forward.portRange');
        }
        return true;
      },
    },
    {
      type: 'number',
      name: 'remotePort',
      message: t('templates.forward.remotePort'),
      default: current?.remotePort,
      validate: (input: number) => {
        if (!validatePort(input)) {
          return t('templates.forward.portRange');
        }
        return true;
      },
    },
    {
      type: 'confirm',
      name: 'addSecrets',
      message: t('templates.forward.linkSecrets'),
      default: !!current?.secrets?.length,
    },
    {
      type: 'input',
      name: 'secrets',
      message: t('templates.forward.secretNames'),
      default: current?.secrets?.join(', '),
      when: (answers) => answers.addSecrets,
    },
    {
      type: 'confirm',
      name: 'addConfigMaps',
      message: t('templates.forward.linkConfigMaps'),
      default: !!current?.configMaps?.length,
    },
    {
      type: 'input',
      name: 'configMaps',
      message: t('templates.forward.configMapNames'),
      default: current?.configMaps?.join(', '),
      when: (answers) => answers.addConfigMaps,
    },
  ]);

  const secrets = answers.secrets
    ? answers.secrets
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
    : undefined;

  const configMaps = answers.configMaps
    ? answers.configMaps
        .split(',')
        .map((c) => c.trim())
        .filter((c) => c.length > 0)
    : undefined;

  return {
    name: answers.name,
    namespace: answers.namespace,
    resourceType: answers.resourceType,
    resourceName: answers.resourceName,
    localPort: answers.localPort,
    remotePort: answers.remotePort,
    secrets,
    configMaps,
  };
}
