"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { toast } from "sonner";

import { UserAvatar } from "@/components/user-avatar";
import { FollowButton } from "@/components/follow-button";
import { dismissSuggestion } from "@/app/actions/suggestions";
import { cn } from "@/lib/utils";
import type { SuggestedProfile } from "@/lib/types";

/** "Followed by Alex", "Followed by Alex and Sam", "Followed by Alex and 3 others". */
function mutualLabel(u: SuggestedProfile): string | null {
  const count = u.mutual_count ?? 0;
  if (count <= 0) return null;
  const names = u.mutual_names ?? [];
  if (names.length === 0) {
    return `Followed by ${count} ${count === 1 ? "person" : "people"} you follow`;
  }
  if (count === 1) return `Followed by ${names[0]}`;
  if (count === 2 && names.length >= 2) {
    return `Followed by ${names[0]} and ${names[1]}`;
  }
  return `Followed by ${names[0]} and ${count - 1} others`;
}

/**
 * A list of suggested accounts with a Follow button, an optional "Followed by …"
 * mutual-connections label, and a dismiss "x" that permanently hides the
 * suggestion (persisted via dismissSuggestion). Used in the Home empty state,
 * the Explore page, and the right sidebar.
 *
 * Pass `heading` to have this component own its section title — the whole block
 * (heading + list) then disappears together once every suggestion is dismissed,
 * instead of leaving an orphaned heading behind.
 */
export function SuggestedFollows({
  suggestions,
  currentUserId,
  variant = "card",
  showDismiss = true,
  className,
  heading,
}: {
  suggestions: SuggestedProfile[];
  currentUserId: string | null;
  /** "card" = bordered rows; "plain" = flush sidebar rows. */
  variant?: "card" | "plain";
  showDismiss?: boolean;
  className?: string;
  heading?: React.ReactNode;
}) {
  const router = useRouter();
  // Accounts dismissed this session. Kept in a ref so it survives the fresh
  // `suggestions` props a router.refresh() delivers before the server write is
  // visible — otherwise a just-dismissed account could flash back in.
  const dismissedRef = React.useRef<Set<string>>(new Set());
  const [items, setItems] = React.useState<SuggestedProfile[]>(() =>
    suggestions.filter((s) => !dismissedRef.current.has(s.id))
  );

  React.useEffect(() => {
    setItems(suggestions.filter((s) => !dismissedRef.current.has(s.id)));
  }, [suggestions]);

  const dismiss = React.useCallback(
    async (id: string) => {
      dismissedRef.current.add(id);
      setItems((prev) => prev.filter((p) => p.id !== id));

      const res = await dismissSuggestion(id);
      if (res?.error) {
        // Persisting failed — restore the row instead of silently losing it.
        dismissedRef.current.delete(id);
        setItems(suggestions.filter((s) => !dismissedRef.current.has(s.id)));
        toast.error(res.error);
        return;
      }
      // Re-render sibling suggestion lists (e.g. the sidebar) so the same
      // account, now excluded server-side, disappears from them too.
      router.refresh();
    },
    [suggestions, router]
  );

  if (items.length === 0) return null;

  const canDismiss = showDismiss && currentUserId != null;

  const rows = items.map((u) => {
    const label = mutualLabel(u);
    return (
      <li
            key={u.id}
            className={cn(
              "flex items-center gap-3",
              variant === "card"
                ? "rounded-[14px] bg-surface-1 px-3.5 py-2.5 shadow-sm"
                : "px-4 py-2.5 transition-colors hover:bg-muted"
            )}
          >
            <Link
              href={`/${u.username}`}
              className="shrink-0"
              aria-label={u.username}
            >
              <UserAvatar profile={u} className="h-10 w-10" />
            </Link>

            <div className="min-w-0 flex-1 text-left">
              <Link
                href={`/${u.username}`}
                className="block truncate text-sm font-semibold hover:underline"
              >
                {u.display_name || u.username}
              </Link>
              <p className="truncate text-sm text-muted-foreground">
                @{u.username}
              </p>
              {label && (
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {label}
                </p>
              )}
            </div>

            {currentUserId != null && currentUserId !== u.id && (
              <FollowButton targetUserId={u.id} initialStatus="none" size="sm" />
            )}

            {canDismiss && (
              <button
                type="button"
                onClick={() => dismiss(u.id)}
                aria-label={`Dismiss ${u.display_name || u.username}`}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="h-4 w-4" />
              </button>
            )}
      </li>
    );
  });

  const listClass = cn(variant === "card" && "flex flex-col gap-2");
  const list = <ul className={cn(listClass, !heading && className)}>{rows}</ul>;

  if (!heading) return list;
  // Key the heading + list pair: Next's JSX runtime treats these two siblings
  // as a dynamic array, which otherwise warns about a missing key on the
  // heading element passed in from the parent.
  return (
    <div className={className}>
      {[
        <React.Fragment key="sf-heading">{heading}</React.Fragment>,
        <React.Fragment key="sf-list">{list}</React.Fragment>,
      ]}
    </div>
  );
}
