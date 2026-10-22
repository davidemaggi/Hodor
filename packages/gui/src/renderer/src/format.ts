import i18n from './i18n';

export function formatTime(iso: string | number, seconds = false): string {
  return new Intl.DateTimeFormat(i18n.language, {
    hour: '2-digit',
    minute: '2-digit',
    ...(seconds ? { second: '2-digit' } : {}),
  }).format(new Date(iso));
}

export function formatRelative(iso: string, now = Date.now()): string {
  const days = Math.round((new Date(iso).getTime() - now) / 86_400_000);
  if (Math.abs(days) >= 30) {
    return new Intl.DateTimeFormat(i18n.language, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(new Date(iso));
  }
  return new Intl.RelativeTimeFormat(i18n.language, { numeric: 'auto' }).format(days, 'day');
}

/** ~/.kube/config instead of /Users/sam/.kube/config */
export function tildify(file: string): string {
  return file.replace(/^(\/Users|\/home)\/[^/]+|^[A-Za-z]:\\Users\\[^\\]+/, '~');
}

/** kubectl-style age: 45s, 12m, 3h, 9d */
export function formatAge(iso: string, now = Date.now()): string {
  const seconds = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86_400)}d`;
}
