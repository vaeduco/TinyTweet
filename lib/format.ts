import { formatDistanceToNowStrict } from "date-fns";

/** Short relative time like "5m", "3h", "2d" for feed timestamps. */
export function formatRelativeTime(dateInput: string | Date): string {
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  const full = formatDistanceToNowStrict(date, { addSuffix: false });

  // Compress "5 minutes" -> "5m", "3 hours" -> "3h", etc.
  const [value, unitRaw] = full.split(" ");
  const unitMap: Record<string, string> = {
    second: "s",
    minute: "m",
    hour: "h",
    day: "d",
    month: "mo",
    year: "y",
  };
  const unit = unitRaw?.replace(/s$/, "");
  const short = unit && unitMap[unit] ? `${value}${unitMap[unit]}` : full;
  return short;
}

/** Absolute, human-friendly timestamp for tooltips / detail views. */
export function formatAbsoluteTime(dateInput: string | Date): string {
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  return date.toLocaleString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Compact number formatting for counts: 1200 -> "1.2K". */
export function formatCount(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}K`;
  return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
}
