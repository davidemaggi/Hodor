import chalk from 'chalk';
import { canPrompt, prompt } from '../utils/prompt.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import YAML from 'yaml';
import {
  ClusterDiscovery,
  ContextManager,
  KubeConfigMerger,
  KubeConfigParser,
  extractContextsFromFiles,
} from '@hodor/core';
import type { Cluster } from '@hodor/core';
import { askForFile, clusterLabel, expandHome, fail } from '../utils/shared.js';
import { t } from '../i18n.js';

/**
 * Merge kubeconfig files. By default they go into kubectl's default kubeconfig (backed up first).
 */
export async function configMergeCommand(
  files: string[],
  options: { output?: string; yes?: boolean } = {}
): Promise<void> {
  try {
    files = files.length > 0 ? files.map(expandHome) : await askForFiles();
    for (const file of files) {
      await fs.access(file).catch(() => fail(t('config.fileNotFound', { file })));
    }

    // At a terminal: pick the contexts and the kubeconfig that receives them
    if (!options.output && !options.yes && canPrompt()) {
      await guidedMerge(files);
      return;
    }

    const parser = new KubeConfigParser();
    const manager = new ContextManager();
    const target = options.output || manager.getConfigPath();

    // With -o the inputs are merged on their own; otherwise into the default kubeconfig
    const plan = options.output
      ? {
          ...(await new KubeConfigMerger().mergeFiles(files)),
          inputs: files,
          added: [] as string[],
        }
      : await new KubeConfigMerger().planMerge(target, files);
    const { config, skipped, inputs } = plan;

    const targetLabel = t('config.previewTarget');
    const contextsLabel = t('config.previewContexts');
    const width = Math.max(targetLabel.length, contextsLabel.length) + 1;
    const contextNames = config.contexts.map((c) => c.name).join(', ') || t('config.none');
    console.log(chalk.cyan(`\n${t('config.previewTitle')}`));
    console.log(chalk.dim(`  ${targetLabel.padEnd(width)}${target}`));
    console.log(chalk.dim(`  ${contextsLabel.padEnd(width)}${contextNames}`));
    for (const s of skipped) {
      console.log(
        chalk.yellow(
          `  ⚠ ${t('config.skipped', { kind: s.kind, name: s.name, source: inputs[s.source] })}`
        )
      );
    }

    if (!options.yes) {
      const { ok } = await prompt<{ ok: boolean }>([
        {
          type: 'confirm',
          name: 'ok',
          message: t('config.confirm', { target }),
          default: true,
        },
      ]);
      if (!ok) {
        console.log(chalk.dim(t('config.cancelled')));
        return;
      }
    }

    if (options.output) {
      await parser.writeConfig(target, config);
    } else {
      const { backup } = await manager.mergeFiles(files);
      if (backup) console.log(chalk.dim(`  ${t('config.backup', { path: backup })}`));
    }

    console.log(chalk.green(`✔ ${t('config.merged', { count: files.length, target })}`));
  } catch (error: any) {
    fail(t('config.failed', { error: error.message }));
  }
}

/** No files on the command line: ask for one, then offer to add more */
async function askForFiles(): Promise<string[]> {
  const files = [await askForFile(t('config.askFile'))];
  for (;;) {
    const { more } = await prompt<{ more: boolean }>([
      { type: 'confirm', name: 'more', message: t('config.askMore'), default: false },
    ]);
    if (!more) return files;
    files.push(await askForFile(t('config.askFile')));
  }
}

/**
 * Save some contexts (with their clusters and users) as a new kubeconfig.
 * Names pick contexts; without names they're ticked from a list. Without -o the file is asked
 * for at a terminal, and printed when the output is redirected.
 */
export async function configExportCommand(
  names: string[],
  options: { output?: string } = {}
): Promise<void> {
  try {
    const clusters = await new ClusterDiscovery().list();
    if (clusters.length === 0) fail(t('common.noClusters'));
    const showSource = new Set(clusters.map((c) => c.sourceFile)).size > 1;

    let picked: Cluster[];
    if (names.length === 0) {
      const { ids } = await prompt<{ ids: string[] }>([
        {
          type: 'checkbox',
          name: 'ids',
          message: `${t('config.export.pick')} ${chalk.dim(t('common.checkboxHint'))}`,
          pageSize: 15,
          choices: clusters.map((c) => ({
            name: clusterLabel(c, showSource),
            value: c.id,
            short: c.name,
          })),
          validate: (chosen: string[]) => chosen.length > 0 || t('common.pickAtLeastOne'),
        },
      ]);
      picked = clusters.filter((c) => ids.includes(c.id));
    } else {
      picked = names.map((name) => {
        const matches = clusters.filter((c) => c.name === name);
        if (matches.length === 0) fail(t('common.clusterNotFound', { name }));
        if (matches.length > 1) {
          fail(
            t('config.export.ambiguous', {
              name,
              files: matches.map((c) => c.sourceFile).join(', '),
            })
          );
        }
        return matches[0];
      });
    }

    const { config, renamed } = await extractContextsFromFiles(
      picked.map((c) => ({ file: c.sourceFile, context: c.name }))
    );
    const yaml = YAML.stringify(config);

    let output = options.output && expandHome(options.output);
    if (!output && !process.stdout.isTTY) {
      process.stdout.write(yaml);
      return;
    }
    if (!output) {
      const suggested =
        picked.length === 1 ? `${picked[0].name}.kubeconfig.yaml` : 'hodor-export.kubeconfig.yaml';
      ({ output } = await prompt<{ output: string }>([
        {
          type: 'input',
          name: 'output',
          message: t('config.export.askFile'),
          default: suggested,
          filter: (input: string) => expandHome(input.trim()),
        },
      ]));
    }

    // Writing over a kubeconfig Hodor reads would throw away its other contexts
    const known = new Set(clusters.map((c) => path.resolve(c.sourceFile)));
    if (known.has(path.resolve(output!))) fail(t('config.export.wouldOverwrite', { file: output }));

    await new KubeConfigParser().writeConfig(output!, config);
    console.log(
      chalk.green(`✔ ${t('config.export.saved', { count: config.contexts.length, file: output })}`)
    );
    for (const r of renamed) {
      console.log(
        chalk.yellow(`  ⚠ ${t('config.export.renamed', { kind: r.kind, from: r.from, to: r.to })}`)
      );
    }
    console.log(chalk.dim(`  ${t('config.export.credentials')}`));
  } catch (error: any) {
    fail(t('config.export.failed', { error: error.message }));
  }
}

/** Your kubeconfigs (in ~/.kube, and kubectl's own file even if it doesn't exist yet) */
async function knownKubeconfigs(): Promise<
  Array<{ path: string; count: number; isDefault: boolean }>
> {
  const parser = new KubeConfigParser();
  const defaultPath = path.resolve(new ContextManager().getConfigPath());
  const found = new Map<string, number>();
  for (const d of await parser.discover())
    found.set(path.resolve(d.path), d.config.contexts?.length ?? 0);
  if (!found.has(defaultPath)) found.set(defaultPath, 0);
  return [...found]
    .map(([file, count]) => ({ path: file, count, isDefault: file === defaultPath }))
    .sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || a.path.localeCompare(b.path));
}

/** Tick contexts from the files, choose the target, see what happens, confirm */
async function guidedMerge(files: string[]): Promise<void> {
  const parser = new KubeConfigParser();
  const choices: Array<{ name: string; value: string; short: string }> = [];
  for (const file of files) {
    const config = await parser.parseFile(file);
    for (const ctx of config.contexts ?? []) {
      choices.push({
        name: `${ctx.name}${files.length > 1 ? chalk.dim(` (${path.basename(file)})`) : ''}`,
        value: JSON.stringify([file, ctx.name]),
        short: ctx.name,
      });
    }
  }
  if (choices.length === 0) fail(t('config.guided.noContexts'));

  const targets = await knownKubeconfigs();
  const answers = await prompt<{ picked: string[]; target: string }>([
    {
      type: 'checkbox',
      name: 'picked',
      message: `${t('config.guided.pick')} ${chalk.dim(t('common.checkboxHint'))}`,
      pageSize: 15,
      choices: choices.map((c) => ({ ...c, checked: true })),
      validate: (chosen: string[]) => chosen.length > 0 || t('common.pickAtLeastOne'),
    },
    {
      type: 'list',
      name: 'target',
      message: t('config.guided.into'),
      default: targets.find((x) => x.isDefault)?.path,
      choices: targets.map((x) => ({
        name: `${x.path}${chalk.dim(
          ` · ${x.isDefault ? `${t('config.guided.kubectlFile')} · ` : ''}${t('config.guided.contexts', { count: x.count })}`
        )}`,
        value: x.path,
        short: x.path,
      })),
    },
  ]);

  const refs = answers.picked.map((v) => {
    const [file, context] = JSON.parse(v) as [string, string];
    return { file, context };
  });
  const manager = new ContextManager(answers.target);
  const plan = await manager.planContexts(refs);

  console.log(chalk.cyan(`\n${t('config.previewTitle')}`));
  for (const c of plan.contexts) {
    if (c.status === 'added') console.log(chalk.green(`  + ${c.as}`));
    else if (c.status === 'renamed')
      console.log(
        chalk.yellow(
          `  + ${c.as} ${chalk.dim(t('config.guided.renamed', { name: c.from.context }))}`
        )
      );
    else console.log(chalk.dim(`  = ${c.as} ${t('config.guided.present')}`));
  }
  const writing = plan.contexts.filter((c) => c.status !== 'present').length;
  if (writing === 0) {
    console.log(chalk.dim(`\n${t('config.guided.nothing')}`));
    return;
  }

  const { ok } = await prompt<{ ok: boolean }>([
    {
      type: 'confirm',
      name: 'ok',
      message: t('config.guided.confirm', { count: writing, target: answers.target }),
      default: true,
    },
  ]);
  if (!ok) {
    console.log(chalk.dim(t('config.cancelled')));
    return;
  }

  const result = await manager.mergeContexts(refs);
  console.log(
    chalk.green(`✔ ${t('config.guided.done', { count: writing, target: answers.target })}`)
  );
  if (result.backup) console.log(chalk.dim(`  ${t('config.backup', { path: result.backup })}`));
}
