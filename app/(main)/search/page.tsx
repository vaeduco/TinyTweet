import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { searchUsers, searchPosts, searchHashtags } from "@/lib/queries";
import { SearchBar } from "@/components/search-bar";
import { UserCard } from "@/components/user-card";
import { PostCard } from "@/components/post-card";
import { formatCount } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { FollowState } from "@/lib/types";

const TABS = [
  { key: "people", label: "People" },
  { key: "posts", label: "Posts" },
  { key: "hashtags", label: "Hashtags" },
] as const;

type SearchTab = (typeof TABS)[number]["key"];

export const metadata = { title: "Search" };
export const dynamic = "force-dynamic";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tab?: string }>;
}) {
  const { q, tab } = await searchParams;
  const query = (q ?? "").trim();
  const activeTab: SearchTab = TABS.some((t) => t.key === tab)
    ? (tab as SearchTab)
    : "people";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div>
      <div className="sticky top-14 z-30 border-b border-border bg-background px-4 py-3">
        <h1 className="sr-only">Search</h1>
        <SearchBar defaultValue={query} />
      </div>

      {query === "" ? (
        <div className="px-6 py-16 text-center">
          <p className="text-lg font-bold">Search TinyTweet</p>
          <p className="mt-1 text-muted-foreground">
            Find people by username or posts by keyword or #hashtag.
          </p>
        </div>
      ) : (
        <>
          <nav aria-label="Search results" className="flex border-b border-border">
            {TABS.map((t) => (
              <Link
                key={t.key}
                href={`/search?q=${encodeURIComponent(query)}&tab=${t.key}`}
                aria-current={activeTab === t.key ? "page" : undefined}
                className={cn(
                  "flex-1 py-3 text-center text-sm font-medium transition-colors hover:bg-muted/40",
                  activeTab === t.key
                    ? "border-b-2 border-primary text-foreground"
                    : "text-muted-foreground"
                )}
              >
                {t.label}
              </Link>
            ))}
          </nav>

          {activeTab === "people" ? (
            <PeopleResults query={query} viewerId={user?.id ?? null} />
          ) : activeTab === "posts" ? (
            <PostResults query={query} viewerId={user?.id ?? null} />
          ) : (
            <HashtagResults query={query} />
          )}
        </>
      )}
    </div>
  );
}

async function PeopleResults({
  query,
  viewerId,
}: {
  query: string;
  viewerId: string | null;
}) {
  const supabase = await createClient();
  const users = await searchUsers(supabase, query);

  const followStatus = new Map<string, FollowState>();
  if (viewerId && users.length > 0) {
    const { data } = await supabase
      .from("follows")
      .select("following_id, status")
      .eq("follower_id", viewerId)
      .in(
        "following_id",
        users.map((u) => u.id)
      );
    for (const f of data ?? []) followStatus.set(f.following_id, f.status);
  }

  if (users.length === 0) {
    return (
      <div className="px-6 py-16 text-center">
        <p className="text-lg font-bold">No people found</p>
        <p className="mt-1 text-muted-foreground">
          No results for &ldquo;{query}&rdquo;.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 p-2">
      {users.map((u) => (
        <UserCard
          key={u.id}
          profile={u}
          currentUserId={viewerId}
          initialStatus={followStatus.get(u.id) ?? "none"}
        />
      ))}
    </div>
  );
}

async function PostResults({
  query,
  viewerId,
}: {
  query: string;
  viewerId: string | null;
}) {
  const supabase = await createClient();
  const posts = await searchPosts(supabase, query, viewerId);

  if (posts.length === 0) {
    return (
      <div className="px-6 py-16 text-center">
        <p className="text-lg font-bold">No posts found</p>
        <p className="mt-1 text-muted-foreground">
          No results for &ldquo;{query}&rdquo;.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 p-2">
      {posts.map((p) => (
        <PostCard key={p.id} post={p} currentUserId={viewerId} />
      ))}
    </div>
  );
}

async function HashtagResults({ query }: { query: string }) {
  const supabase = await createClient();
  const tags = await searchHashtags(supabase, query);

  if (tags.length === 0) {
    return (
      <div className="px-6 py-16 text-center">
        <p className="text-lg font-bold">No hashtags found</p>
        <p className="mt-1 text-muted-foreground">
          No results for &ldquo;{query}&rdquo;.
        </p>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-2 p-2">
      {tags.map((t) => (
        <li key={t.tag}>
          <Link
            href={`/hashtag/${t.tag}`}
            className="block rounded-[14px] bg-surface-1 px-3.5 py-2.5 shadow-sm transition-colors hover:bg-surface-2/40"
          >
            <p className="truncate font-bold break-anywhere">#{t.tag}</p>
            <p className="text-sm text-muted-foreground">
              {formatCount(t.count)} {t.count === 1 ? "post" : "posts"}
            </p>
          </Link>
        </li>
      ))}
    </ul>
  );
}
