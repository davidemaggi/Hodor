/** An entry of a searchable list: what gets stored and what gets shown */
export interface MatchOption {
  value: string;
  label: string;
}

/**
 * Options whose label contains every word of the query (case-insensitive), best first:
 * exact label, then labels starting with the query, then the rest. Ties keep their order.
 * An empty query returns everything as is.
 */
export function matchOptions<T extends MatchOption>(options: T[], query: string): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return options;
  const words = q.split(/\s+/);
  const rank = (label: string) => (label === q ? 0 : label.startsWith(q) ? 1 : 2);
  return options
    .map((option, index) => ({ option, index, label: option.label.toLowerCase() }))
    .filter((x) => words.every((w) => x.label.includes(w)))
    .sort((a, b) => rank(a.label) - rank(b.label) || a.index - b.index)
    .map((x) => x.option);
}
