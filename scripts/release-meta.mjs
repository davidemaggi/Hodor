#!/usr/bin/env node
// Works out what a release is made of: version, tag, title and notes.
// Used by .github/workflows/release.yml; run it locally to preview a release:
//
//   pnpm --filter @hodor/core build && node scripts/release-meta.mjs
//
// Fails when the package versions disagree, or when CHANGELOG.md has no section for the version.
// Needs the core built (it borrows the codename from there, so there's one list of names).

import { readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const root = new URL('..', import.meta.url);
const read = (file) => readFileSync(new URL(file, root), 'utf8');
const { codename } = require('../packages/core/dist/utils/version.js');

const version = JSON.parse(read('package.json')).version;

const versions = {
  'package.json': version,
  ...Object.fromEntries(
    ['core', 'cli', 'gui'].map((name) => {
      const file = `packages/${name}/package.json`;
      return [file, JSON.parse(read(file)).version];
    })
  ),
  'packages/core/src/index.ts VERSION': /VERSION = '([^']+)'/.exec(
    read('packages/core/src/index.ts')
  )?.[1],
};
const wrong = Object.entries(versions).filter(([, v]) => v !== version);
if (wrong.length) {
  fail(`Versions disagree with ${version}:\n${wrong.map(([f, v]) => `  ${f}: ${v}`).join('\n')}`);
}

const match = /^(\d+)\.(\d+)\.(\d+)(-.+)?$/.exec(version);
if (!match) fail(`${version} is not a SemVer version`);
const [, , , patch, pre] = match;

// Patch releases go unnamed; the rest carry their major's codename
const name = patch === '0' ? codename(version) : undefined;
const title = `Hodor ${version}${name ? ` “${name}”` : ''}`;

const changelog = read('CHANGELOG.md');
const heading = changelog.split('\n').findIndex((line) => line.startsWith(`## [${version}]`));
if (heading < 0) fail(`CHANGELOG.md has no "## [${version}]" section`);
const lines = changelog.split('\n').slice(heading + 1);
const end = lines.findIndex((line) => line.startsWith('## '));
const notes = (end < 0 ? lines : lines.slice(0, end)).join('\n').trim();
if (!notes) fail(`The CHANGELOG.md section for ${version} is empty`);

const meta = { version, tag: `v${version}`, title, prerelease: Boolean(pre) };
writeFileSync(new URL('release-notes.md', root), `${notes}\n`);
console.log(JSON.stringify(meta, null, 2));
console.log(`\nNotes written to release-notes.md (${notes.split('\n').length} lines)`);

if (process.env.GITHUB_OUTPUT) {
  appendFileSync(
    process.env.GITHUB_OUTPUT,
    Object.entries(meta)
      .map(([k, v]) => `${k}=${v}\n`)
      .join('')
  );
}

function fail(message) {
  console.error(`release-meta: ${message}`);
  process.exit(1);
}
