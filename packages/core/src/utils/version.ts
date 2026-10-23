/**
 * Version helpers. Each major release has a Game of Thrones codename, one letter per major.
 */
const CODENAMES: Record<number, string> = {
  1: 'Aerys',
};

export function codename(version: string): string | undefined {
  const major = Number(version.split('.')[0]);
  return CODENAMES[major];
}

interface Parsed {
  core: [number, number, number];
  pre: string[];
}

function parse(version: string): Parsed | undefined {
  const match = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+.*)?$/.exec(version.trim());
  if (!match) return undefined;
  return {
    core: [Number(match[1]), Number(match[2]), Number(match[3])],
    pre: match[4] ? match[4].split('.') : [],
  };
}

/** SemVer precedence: negative if a < b, positive if a > b, 0 if equal or unparseable */
export function compareVersions(a: string, b: string): number {
  const pa = parse(a);
  const pb = parse(b);
  if (!pa || !pb) return 0;
  for (let i = 0; i < 3; i++) {
    if (pa.core[i] !== pb.core[i]) return pa.core[i] - pb.core[i];
  }
  // A release outranks its pre-releases
  if (!pa.pre.length || !pb.pre.length) return pb.pre.length - pa.pre.length;
  for (let i = 0; i < Math.max(pa.pre.length, pb.pre.length); i++) {
    const x = pa.pre[i];
    const y = pb.pre[i];
    if (x === undefined) return -1;
    if (y === undefined) return 1;
    const nx = /^\d+$/.test(x);
    const ny = /^\d+$/.test(y);
    if (nx && ny && Number(x) !== Number(y)) return Number(x) - Number(y);
    if (nx !== ny) return nx ? -1 : 1;
    if (x !== y) return x < y ? -1 : 1;
  }
  return 0;
}

export const isPrerelease = (version: string) => (parse(version)?.pre.length ?? 0) > 0;
