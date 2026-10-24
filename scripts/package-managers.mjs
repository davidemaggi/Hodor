#!/usr/bin/env node
// Writes the winget manifests and the Chocolatey package for one release, from
// packaging/package-managers.json and the release's signed Windows installer.
// Used by .github/workflows/package-managers.yml; run it locally to look at the output:
//
//   node scripts/package-managers.mjs --version 1.1.0 --installer path/to/Hodor-1.1.0-win-x64-signed.exe \
//     --product-code '{…}' --display-name 'Hodor 1.1.0' --out out/package-managers
//
// --product-code and --display-name are what the installer writes in "Installed apps" (the
// workflow reads them from the registry after a real install). Without them the winget installer
// manifest just leaves them out.

import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

const { values: args } = parseArgs({
  options: {
    version: { type: 'string' },
    installer: { type: 'string' },
    'product-code': { type: 'string' },
    'display-name': { type: 'string' },
    repo: { type: 'string', default: process.env.GITHUB_REPOSITORY || 'davidemaggi/Hodor' },
    date: { type: 'string', default: new Date().toISOString().slice(0, 10) },
    out: { type: 'string', default: 'out/package-managers' },
  },
});
if (!args.version || !args.installer) fail('--version and --installer are required');

const root = new URL('..', import.meta.url);
const meta = JSON.parse(readFileSync(new URL('packaging/package-managers.json', root), 'utf-8'));
const version = args.version.replace(/^v/, '');
const tag = `v${version}`;
const asset = meta.windowsInstaller.asset.replace('{version}', version);
const installerUrl = `https://github.com/${args.repo}/releases/download/${tag}/${asset}`;
const sha256 = createHash('sha256').update(readFileSync(args.installer)).digest('hex');
const releaseUrl = `https://github.com/${args.repo}/releases/tag/${tag}`;
const notes = releaseNotes(version);

// ── winget ──────────────────────────────────────────────────────────────────────────────────────
const MANIFEST_VERSION = '1.12.0';
const id = meta.winget.id;
const wingetDir = join(
  args.out,
  'winget',
  'manifests',
  id[0].toLowerCase(),
  ...id.split('.'),
  version
);
mkdirSync(wingetDir, { recursive: true });
const header = (type) =>
  `# yaml-language-server: $schema=https://aka.ms/winget-manifest.${type}.${MANIFEST_VERSION}.schema.json\n\n`;
const write = (file, type, body) => writeFileSync(join(wingetDir, file), header(type) + yaml(body));

write(`${id}.yaml`, 'version', {
  PackageIdentifier: id,
  PackageVersion: version,
  DefaultLocale: 'en-US',
  ManifestType: 'version',
  ManifestVersion: MANIFEST_VERSION,
});

const entry = args['product-code']
  ? {
      ProductCode: args['product-code'],
      AppsAndFeaturesEntries: [
        {
          DisplayName: args['display-name'] || `${meta.name} ${version}`,
          Publisher: meta.publisher,
          DisplayVersion: version,
          ProductCode: args['product-code'],
        },
      ],
    }
  : {};
write(`${id}.installer.yaml`, 'installer', {
  PackageIdentifier: id,
  PackageVersion: version,
  Platform: ['Windows.Desktop'],
  MinimumOSVersion: meta.windowsInstaller.minimumOSVersion,
  InstallerType: 'nullsoft',
  Scope: 'user',
  InstallModes: ['interactive', 'silent', 'silentWithProgress'],
  UpgradeBehavior: 'install',
  Commands: meta.windowsInstaller.commands,
  ReleaseDate: args.date,
  Installers: [
    {
      Architecture: 'x64',
      InstallerUrl: installerUrl,
      InstallerSha256: sha256.toUpperCase(),
      ...entry,
    },
  ],
  ManifestType: 'installer',
  ManifestVersion: MANIFEST_VERSION,
});

for (const [locale, text] of Object.entries(meta.locales)) {
  const isDefault = locale === 'en-US';
  write(`${id}.locale.${locale}.yaml`, isDefault ? 'defaultLocale' : 'locale', {
    PackageIdentifier: id,
    PackageVersion: version,
    PackageLocale: locale,
    Publisher: meta.publisher,
    PublisherUrl: meta.publisherUrl,
    PublisherSupportUrl: meta.supportUrl,
    Author: meta.author,
    PackageName: meta.name,
    PackageUrl: meta.projectUrl,
    License: meta.license,
    LicenseUrl: meta.licenseUrl,
    Copyright: meta.copyright,
    ShortDescription: text.shortDescription,
    Description: text.description,
    ...(isDefault ? { Moniker: meta.winget.moniker } : {}),
    Tags: meta.tags,
    ...(isDefault && notes ? { ReleaseNotes: notes } : {}),
    ReleaseNotesUrl: releaseUrl,
    Documentations: [{ DocumentLabel: 'README', DocumentUrl: meta.docsUrl }],
    ManifestType: isDefault ? 'defaultLocale' : 'locale',
    ManifestVersion: MANIFEST_VERSION,
  });
}

// ── Chocolatey ──────────────────────────────────────────────────────────────────────────────────
const choco = meta.chocolatey;
const chocoDir = join(args.out, 'chocolatey', choco.id);
mkdirSync(join(chocoDir, 'tools'), { recursive: true });
const repoPath = args.repo.split('/');
const iconUrl = `https://cdn.jsdelivr.net/gh/${repoPath[0]}/${repoPath[1]}@${tag}/${meta.icon}`;
const en = meta.locales['en-US'];

writeFileSync(
  join(chocoDir, `${choco.id}.nuspec`),
  `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://schemas.microsoft.com/packaging/2015/06/nuspec.xsd">
  <metadata>
    <id>${choco.id}</id>
    <version>${version}</version>
    <title>${xml(meta.name)}</title>
    <authors>${xml(meta.author)}</authors>
    <owners>${xml(choco.owners)}</owners>
    <projectUrl>${meta.projectUrl}</projectUrl>
    <projectSourceUrl>${meta.projectUrl}</projectSourceUrl>
    <packageSourceUrl>${meta.projectUrl}/tree/main/packaging</packageSourceUrl>
    <docsUrl>${meta.docsUrl}</docsUrl>
    <bugTrackerUrl>${meta.supportUrl}</bugTrackerUrl>
    <iconUrl>${iconUrl}</iconUrl>
    <licenseUrl>${meta.licenseUrl}</licenseUrl>
    <requireLicenseAcceptance>false</requireLicenseAcceptance>
    <copyright>${xml(meta.copyright)}</copyright>
    <tags>${meta.tags.join(' ')}</tags>
    <summary>${xml(en.shortDescription)}</summary>
    <description>${xml(en.description)}</description>
    <releaseNotes>${xml(notes ? `${notes}\n\n${releaseUrl}` : releaseUrl)}</releaseNotes>
  </metadata>
  <files>
    <file src="tools\\**" target="tools" />
  </files>
</package>
`
);

writeFileSync(
  join(chocoDir, 'tools', 'chocolateyinstall.ps1'),
  `$ErrorActionPreference = 'Stop'

# The signed installer from the GitHub release. It installs for the current user and puts the
# ${meta.windowsInstaller.commands.join(', ')} command on that user's PATH.
$packageArgs = @{
  packageName    = $env:ChocolateyPackageName
  fileType       = 'exe'
  url64bit       = '${installerUrl}'
  checksum64     = '${sha256}'
  checksumType64 = 'sha256'
  softwareName   = '${meta.name}*'
  silentArgs     = '${meta.windowsInstaller.silentArgs}'
  validExitCodes = @(0)
}
Install-ChocolateyPackage @packageArgs
`
);

writeFileSync(
  join(chocoDir, 'tools', 'chocolateyuninstall.ps1'),
  `$ErrorActionPreference = 'Stop'

[array]$keys = Get-UninstallRegistryKey -SoftwareName '${meta.name}*'
if ($keys.Count -eq 0) {
  Write-Warning "${meta.name} isn't installed any more: nothing to uninstall."
  return
}
foreach ($key in $keys) {
  # electron-builder writes '"C:\\...\\Uninstall ${meta.name}.exe" /currentuser'
  if ($key.UninstallString -match '^"([^"]+)"\\s*(.*)$') {
    $file = $Matches[1]
    $silentArgs = "$($Matches[2]) ${meta.windowsInstaller.silentArgs}".Trim()
  } else {
    $file = $key.UninstallString
    $silentArgs = '${meta.windowsInstaller.silentArgs}'
  }
  Uninstall-ChocolateyPackage -PackageName $env:ChocolateyPackageName -FileType 'exe' \`
    -SilentArgs $silentArgs -File $file -ValidExitCodes @(0)
}
`
);

console.log(
  JSON.stringify(
    { version, installerUrl, sha256, winget: wingetDir, chocolatey: chocoDir },
    null,
    2
  )
);

// ── helpers ─────────────────────────────────────────────────────────────────────────────────────

/** The CHANGELOG section of this version, as plain text */
function releaseNotes(v) {
  const lines = readFileSync(new URL('CHANGELOG.md', root), 'utf-8').split('\n');
  const start = lines.findIndex((l) => l.startsWith(`## [${v}]`));
  if (start < 0) return '';
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((l) => l.startsWith('## '));
  return (end < 0 ? rest : rest.slice(0, end))
    .join('\n')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .trim();
}

/** Plain YAML: mappings, lists, strings as JSON (valid YAML double-quoted scalars) */
function yaml(value, indent = '') {
  if (Array.isArray(value)) {
    return value
      .map((item) =>
        item && typeof item === 'object'
          ? `${indent}- ${yaml(item, `${indent}  `).trimStart()}`
          : `${indent}- ${scalar(item)}\n`
      )
      .join('');
  }
  return Object.entries(value)
    .map(([key, v]) =>
      v && typeof v === 'object'
        ? `${indent}${key}:\n${yaml(v, `${indent}  `)}`
        : `${indent}${key}: ${scalar(v)}\n`
    )
    .join('');
}

function scalar(v) {
  return typeof v === 'string' ? JSON.stringify(v) : String(v);
}

function xml(text) {
  return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function fail(message) {
  console.error(`package-managers: ${message}`);
  process.exit(1);
}
