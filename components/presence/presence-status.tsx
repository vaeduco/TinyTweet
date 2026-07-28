"use client";

import { usePresence } from "@/components/presence/presence-provider";
import { formatLastSeen } from "@/lib/presence";
import { cn } from "@/lib/utils";

/**
 * A small "Active now" / "last seen" line: a green dot + "Active now" when the
 * user is in the Presence channel, otherwise a muted dot + relative last-seen.
 */
export function PresenceStatus({
  userId,
  lastSeenAt,
  className,
}: {
  userId: string;
  lastSeenAt: string | null;
  className?: string;
}) {
  const { isOnline } = usePresence();
  const online = isOnline(userId);
  const label = online ? "Active now" : formatLastSeen(lastSeenAt);
  // Give screen readers context for a bare relative time ("5m ago" ->
  // "Last seen 5m ago"); "Active now" and "Offline" already stand alone.
  const withPrefix = !online && !!lastSeenAt;

  return (
    <span className={cn("flex items-center gap-1.5 text-xs", className)}>
      <span
        className={cn(
          "h-2 w-2 shrink-0 rounded-full",
          online ? "bg-green-500" : "bg-muted-foreground/40"
        )}
        aria-hidden
      />
      {/* The relative time depends on the clock, so it can differ between the
          server render and hydration — suppress the (recoverable) mismatch on
          the direct parent of the text node, where React actually checks it. */}
      <span
        className={cn(
          "truncate",
          online
            ? "font-medium text-green-600 dark:text-green-500"
            : "text-muted-foreground"
        )}
        suppressHydrationWarning
      >
        {withPrefix && <span className="sr-only">Last seen </span>}
        {label}
      </span>
    </span>
  );
}
