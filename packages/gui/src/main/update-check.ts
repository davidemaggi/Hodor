import { net } from 'electron';
import { VERSION, compareVersions, isPrerelease } from '@hodor/core';
import type { UpdateInfo } from '../shared/api';

const REPO = 'davidemaggi/Hodor';
export const RELEASES_URL = `https://github.com/${REPO}/releases`;
const CACHE_MS = 6 * 60 * 60 * 1000;

let cached: { at: number; info: UpdateInfo } | undefined;

interface GitHubRelease {
  tag_name: string;
  html_url: string;
  draft: boolean;
  prerelease: boolean;
}

/**
 * Is there a newer release? Pre-releases only count when this build is one.
 * One anonymous request to GitHub's public API; nothing about the user is sent.
 */
export async function checkForUpdate(force = false): Promise<UpdateInfo> {
  if (!force && cached && Date.now() - cached.at < CACHE_MS) return cached.info;
  const response = await net.fetch(`https://api.github.com/repos/${REPO}/releases?per_page=20`, {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': `Hodor/${VERSION}` },
  });
  if (!response.ok) throw new Error(`GitHub answered ${response.status}`);
  const releases = (await response.json()) as GitHubRelease[];
  const wantPre = isPrerelease(VERSION);
  const newest = releases
    .filter((r) => !r.draft && (wantPre || !r.prerelease))
    .sort((a, b) => compareVersions(b.tag_name, a.tag_name))[0];

  const info: UpdateInfo =
    newest && compareVersions(newest.tag_name, VERSION) > 0
      ? { current: VERSION, latest: newest.tag_name.replace(/^v/, ''), url: newest.html_url }
      : { current: VERSION };
  cached = { at: Date.now(), info };
  return info;
}
