/**
 * Categorize a Date into a temporal bucket for sidebar grouping.
 *
 * Returns one of:
 * - "Today"
 * - "Yesterday"
 * - "Last 7 days"
 * - "Last 30 days"
 * - "February 2026" (month + year for older in current year)
 * - "2025" (just year for previous years)
 */
export function getTemporalBucket(date: Date, now: Date = new Date()): string {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round(
    (today.getTime() - target.getTime()) / 86400000
  );

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return "Last 7 days";
  if (diffDays < 30) return "Last 30 days";

  if (date.getFullYear() !== now.getFullYear()) {
    return String(date.getFullYear());
  }

  // Same year, >30 days: month + year
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

/**
 * Group an array of items into temporal buckets.
 * Items must already be sorted newest-first.
 * Returns an array of { bucket, items } preserving order.
 */
export function groupByTemporalBucket<T>(
  items: T[],
  getDate: (item: T) => Date | undefined,
  now: Date = new Date()
): { bucket: string; items: T[] }[] {
  const groups: { bucket: string; items: T[] }[] = [];
  let currentBucket = "";

  for (const item of items) {
    const date = getDate(item);
    const bucket = date ? getTemporalBucket(date, now) : "Unknown";
    if (bucket !== currentBucket) {
      groups.push({ bucket, items: [] });
      currentBucket = bucket;
    }
    groups[groups.length - 1].items.push(item);
  }

  return groups;
}
