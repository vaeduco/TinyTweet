import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { getTrendingHashtags, getWhoToFollow } from "@/lib/queries";
import { SearchBar } from "@/components/search-bar";
import { UserAvatar } from "@/components/user-avatar";
import { FollowButton } from "@/components/follow-button";
import { formatCount } from "@/lib/format";

export async function RightSidebar({ viewerId }: { viewerId: string | null }) {
  const supabase = await createClient();
  const [trends, suggestions] = await Promise.all([
    getTrendingHashtags(supabase, { hours: 24, limit: 15 }),
    getWhoToFollow(supabase, viewerId, 10),
  ]);

  return (
    <aside
      aria-label="Trending and suggestions"
      className="scrollbar-subtle sticky top-14 hidden h-[calc(100dvh-3.5rem)] w-[350px] shrink-0 flex-col gap-4 overflow-y-auto py-3 pl-6 xl:flex"
    >
      <SearchBar />

      <section className="overflow-hidden rounded-2xl bg-surface-1 shadow-sm">
        <h2 className="px-4 pb-1 pt-3 text-lg font-extrabold">Trending</h2>
        {trends.length === 0 ? (
          <p className="px-4 pb-4 text-sm text-muted-foreground">
            No trends yet — post with a #hashtag to start one.
          </p>
        ) : (
          <ul className="pb-1">
            {trends.map((t, i) => (
              <li key={t.tag}>
                <Link
                  href={`/hashtag/${t.tag}`}
                  className="block px-4 py-2 transition-colors hover:bg-muted"
                >
                  <p className="text-xs text-muted-foreground">
                    {i + 1} · Trending
                  </p>
                  <p className="truncate font-bold break-anywhere">#{t.tag}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatCount(t.count)} {t.count === 1 ? "post" : "posts"}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="overflow-hidden rounded-2xl bg-surface-1 shadow-sm">
        <h2 className="px-4 pb-1 pt-3 text-lg font-extrabold">Who to follow</h2>
        {suggestions.length === 0 ? (
          <p className="px-4 pb-4 text-sm text-muted-foreground">
            No suggestions right now.
          </p>
        ) : (
          <ul className="pb-1">
            {suggestions.map((u) => (
              <li
                key={u.id}
                className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted"
              >
                <Link href={`/${u.username}`} className="shrink-0">
                  <UserAvatar profile={u} className="h-10 w-10" />
                </Link>
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/${u.username}`}
                    className="block truncate text-sm font-semibold hover:underline"
                  >
                    {u.display_name || u.username}
                  </Link>
                  <p className="truncate text-sm text-muted-foreground">
                    @{u.username}
                  </p>
                </div>
                {viewerId && (
                  <FollowButton
                    targetUserId={u.id}
                    initialStatus="none"
                    size="sm"
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </aside>
  );
}

export function RightSidebarSkeleton() {
  return (
    <aside
      aria-hidden="true"
      className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] w-[350px] shrink-0 flex-col gap-4 py-3 pl-6 xl:flex"
    >
      <div className="h-10 w-full animate-pulse rounded-full bg-muted" />
      <div className="h-44 w-full animate-pulse rounded-2xl bg-muted" />
      <div className="h-56 w-full animate-pulse rounded-2xl bg-muted" />
    </aside>
  );
}
