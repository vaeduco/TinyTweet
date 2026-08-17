import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { getTrendingHashtags, getWhoToFollow } from "@/lib/queries";
import { SearchBar } from "@/components/search-bar";
import { SuggestedFollows } from "@/components/suggested-follows";
import { formatCount } from "@/lib/format";

export async function RightSidebar({ viewerId }: { viewerId: string | null }) {
  const supabase = await createClient();
  const [trends, suggestions] = await Promise.all([
    // Effectively "all available": there are far fewer than 50 hashtags in the
    // window and fewer than 50 followable accounts, so these caps just remove
    // the visible limit while staying bounded if the dataset ever grows.
    getTrendingHashtags(supabase, { hours: 72, limit: 50 }),
    getWhoToFollow(supabase, viewerId, 50),
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
        {suggestions.length === 0 ? (
          <>
            <h2 className="px-4 pb-1 pt-3 text-lg font-extrabold">
              Who to follow
            </h2>
            <p className="px-4 pb-4 text-sm text-muted-foreground">
              No suggestions right now.
            </p>
          </>
        ) : (
          <SuggestedFollows
            suggestions={suggestions}
            currentUserId={viewerId}
            variant="plain"
            className="pb-1"
            heading={
              <h2 className="px-4 pb-1 pt-3 text-lg font-extrabold">
                Who to follow
              </h2>
            }
          />
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
