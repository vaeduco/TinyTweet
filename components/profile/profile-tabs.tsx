import Link from "next/link";

import { cn } from "@/lib/utils";

const TABS = [
  { key: "posts", label: "Posts" },
  { key: "replies", label: "Replies" },
  { key: "media", label: "Media" },
  { key: "likes", label: "Likes" },
] as const;

export type ProfileTab = (typeof TABS)[number]["key"];

/** Sticky Posts/Replies/Media/Likes tab bar for the profile page. */
export function ProfileTabs({
  username,
  active,
}: {
  username: string;
  active: ProfileTab;
}) {
  return (
    <nav
      aria-label="Profile sections"
      className="sticky top-14 z-30 flex border-b border-border bg-background"
    >
      {TABS.map((t) => {
        const isActive = t.key === active;
        const href =
          t.key === "posts" ? `/${username}` : `/${username}?tab=${t.key}`;
        return (
          <Link
            key={t.key}
            href={href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex-1 py-3.5 text-center text-sm transition-colors hover:bg-muted/40",
              isActive
                ? "border-b-2 border-primary font-bold text-foreground"
                : "font-medium text-muted-foreground"
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
