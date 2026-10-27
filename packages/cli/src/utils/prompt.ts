import * as fs from 'fs';
import * as tty from 'tty';
import chalk from 'chalk';
import inquirer from 'inquirer';
import search from '@inquirer/search';
import { filterChoices } from './forward-choices.js';
import { t } from '../i18n.js';

type PromptModule = ReturnType<typeof inquirer.createPromptModule>;

let keyboard: NodeJS.ReadStream | null | undefined;
let promptModule: PromptModule | undefined;

/**
 * Where answers come from. Usually stdin. On Windows the installed `hodor` runs on the app's
 * Electron, a GUI program: it writes to the console fine, but its stdin isn't the console, so
 * Inquirer would read end-of-file and fail with ERR_USE_AFTER_CLOSE. There we open the console
 * (CONIN$) ourselves.
 */
function terminalInput(): NodeJS.ReadStream | null {
  if (keyboard !== undefined) return keyboard;
  keyboard = null;
  if (process.platform === 'win32' && process.versions.electron) {
    try {
      // The device name in full: a bare 'CONIN$' is taken as a file in the current folder
      const fd = fs.openSync('\\\\.\\CONIN$', 'r+');
      if (tty.isatty(fd)) keyboard = new tty.ReadStream(fd);
      else fs.closeSync(fd);
    } catch {
      // No console to open: fall back to stdin below
    }
  }
  if (!keyboard && process.stdin.isTTY) keyboard = process.stdin;
  return keyboard;
}

/** Whether there's someone at a terminal to answer questions */
export function canPrompt(): boolean {
  return terminalInput() !== null;
}

/**
 * Inquirer's prompt, reading from the terminal found by terminalInput().
 * Without a terminal (a script, a pipe) it fails with a hint instead of hanging or crashing.
 */
export const prompt: PromptModule = ((questions: any, answers?: any) => {
  const input = terminalInput();
  if (!input) {
    console.error(`\n✖ ${t('common.needsTerminal')}`);
    process.exit(1);
  }
  promptModule ??= inquirer.createPromptModule({ input, output: process.stdout });
  const pending = promptModule(questions, answers);
  // A console we opened ourselves would keep the process alive after the last answer:
  // hold it only while a question is open
  if (input !== process.stdin) {
    input.ref();
    const release = () => input.unref();
    pending.then(release, release);
  }
  return pending;
}) as PromptModule;

export interface SearchChoice<T> {
  name: string;
  value: T;
  description?: string;
  /** Shown once picked, when the name is too busy for that */
  short?: string;
  disabled?: boolean | string;
}

/**
 * A list you filter by typing, shown a page at a time (arrows move, Enter picks). `pinned`
 * choices (e.g. "type it myself") stay at the end whatever is typed.
 */
export async function searchSelect<T>(
  message: string,
  choices: SearchChoice<T>[],
  options: { pinned?: SearchChoice<T>[]; pageSize?: number } = {}
): Promise<T> {
  const input = terminalInput();
  if (!input) {
    console.error(`\n✖ ${t('common.needsTerminal')}`);
    process.exit(1);
  }
  if (input !== process.stdin) input.ref();
  try {
    return await search<T>(
      {
        message,
        pageSize: options.pageSize ?? 12,
        source: async (term) => [...filterChoices(choices, term), ...(options.pinned ?? [])],
        theme: {
          style: {
            keysHelpTip: () =>
              chalk.dim(
                [
                  `↑↓ ${t('common.keys.navigate')}`,
                  `⏎ ${t('common.keys.select')}`,
                  t('common.keys.filter'),
                ].join(' • ')
              ),
          },
        },
      },
      { input, output: process.stdout }
    );
  } finally {
    if (input !== process.stdin) input.unref();
  }
}
