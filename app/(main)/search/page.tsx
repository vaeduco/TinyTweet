import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { searchUsers, searchPosts } from "@/lib/queries";
import { SearchBar } from "@/components/search-bar";
import { UserCard } from "@/components/user-card";
import { PostCard } from "@/components/post-card";
import { cn } from "@/lib/utils";

export const metadata = { title: "Search" };
export const dynamic = "force-dynamic";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tab?: string }>;
}) {
  const { q, tab } = await searchParams;
  const query = (q ?? "").trim();
  const activeTab = tab === "posts" ? "posts" : "people";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div>
      <div className="sticky top-14 z-30 border-b border-border bg-background/80 px-4 py-3 backdrop-blur">
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
          <nav className="flex border-b border-border">
            <Link
              href={`/search?q=${encodeURIComponent(query)}&tab=people`}
              className={cn(
                "flex-1 py-3 text-center text-sm font-medium transition-colors hover:bg-muted/40",
                activeTab === "people"
                  ? "border-b-2 border-primary text-foreground"
                  : "text-muted-foreground"
              )}
            >
              People
            </Link>
            <Link
              href={`/search?q=${encodeURIComponent(query)}&tab=posts`}
              className={cn(
                "flex-1 py-3 text-center text-sm font-medium transition-colors hover:bg-muted/40",
                activeTab === "posts"
                  ? "border-b-2 border-primary text-foreground"
                  : "text-muted-foreground"
              )}
            >
              Posts
            </Link>
          </nav>

          {activeTab === "people" ? (
            <PeopleResults query={query} viewerId={user?.id ?? null} />
          ) : (
            <PostResults query={query} viewerId={user?.id ?? null} />
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

  let followedSet = new Set<string>();
  if (viewerId && users.length > 0) {
    const { data } = await supabase
      .from("follows")
      .select("following_id")
      .eq("follower_id", viewerId)
      .in(
        "following_id",
        users.map((u) => u.id)
      );
    followedSet = new Set((data ?? []).map((f) => f.following_id));
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
    <div>
      {users.map((u) => (
        <UserCard
          key={u.id}
          profile={u}
          currentUserId={viewerId}
          initialFollowing={followedSet.has(u.id)}
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
    <div>
      {posts.map((p) => (
        <PostCard key={p.id} post={p} currentUserId={viewerId} />
      ))}
    </div>
  );
}
