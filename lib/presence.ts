/**
 * Relative "last seen" label for a user who is not currently online:
 * "Just now", "5m ago", "2h ago", "Yesterday", "3d ago", or an absolute date
 * for anything older than a week. Returns "Offline" when no heartbeat has ever
 * been recorded. ("Active now" is decided by live Presence, not this helper.)
 */
export function formatLastSeen(iso: string | null | undefined): string {
  if (!iso) return "Offline";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "Offline";

  const now = Date.now();
  const diff = now - then;
  const MIN = 60_000;
  const HOUR = 3_600_000;
  const DAY = 86_400_000;

  if (diff < MIN) return "Just now";
  if (diff < HOUR) return `${Math.floor(diff / MIN)}m ago`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)}h ago`;

  // Older than a day: compare calendar days so "Yesterday" is accurate.
  const thenDate = new Date(then);
  const nowDate = new Date(now);
  const midnight = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const daysAgo = Math.round((midnight(nowDate) - midnight(thenDate)) / DAY);

  if (daysAgo <= 1) return "Yesterday";
  if (daysAgo < 7) return `${daysAgo}d ago`;

  return thenDate.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    ...(thenDate.getFullYear() !== nowDate.getFullYear()
      ? { year: "numeric" }
      : {}),
  });
}
