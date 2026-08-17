import type { ComponentType } from "react";
import Link from "next/link";
import { Compass, Hash, Sparkles, TrendingUp } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import {
  getTrendingHashtags,
  getWhoToFollow,
  getPopularPosts,
} from "@/lib/queries";
import { SearchBar } from "@/components/search-bar";
import { SuggestedFollows } from "@/components/suggested-follows";
import { PostCard } from "@/components/post-card";
import { EmptyState } from "@/components/empty-state";
import { formatCount } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Explore" };

export default async function ExplorePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const viewerId = user?.id ?? null;

  const [trends, people, posts] = await Promise.all([
    getTrendingHashtags(supabase, { hours: 72, limit: 12 }),
    getWhoToFollow(supabase, viewerId, 6),
    getPopularPosts(supabase, viewerId, 10),
  ]);

  const hasAnything =
    trends.length > 0 || people.length > 0 || posts.length > 0;

  return (
    <div>
      <div className="sticky top-14 z-30 space-y-3 border-b border-border bg-background px-4 py-3">
        <h1 className="text-xl font-bold">Explore</h1>
        <SearchBar />
      </div>

      {!hasAnything ? (
        <EmptyState
          icon={Compass}
          title="Nothing to explore yet"
          description="As people post and follow each other, trends and suggestions will show up here."
        />
      ) : (
        <div className="flex flex-col gap-6 p-4">
          {trends.length > 0 && (
            <section>
              <SectionHeading icon={TrendingUp} title="Trending" />
              <ul className="flex flex-wrap gap-2">
                {trends.map((t) => (
                  <li key={t.tag}>
                    <Link
                      href={`/hashtag/${t.tag}`}
                      className="flex items-center gap-1 rounded-full bg-surface-1 py-1.5 pl-2.5 pr-3 text-sm font-semibold shadow-sm transition-colors hover:bg-surface-2/60"
                    >
                      <Hash className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                      <span className="max-w-[12rem] truncate break-anywhere">
                        {t.tag}
                      </span>
                      <span className="font-normal text-muted-foreground">
                        {formatCount(t.count)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {people.length > 0 && (
            <SuggestedFollows
              suggestions={people}
              currentUserId={viewerId}
              heading={<SectionHeading icon={Sparkles} title="Suggested for you" />}
            />
          )}

          {posts.length > 0 && (
            <section>
              <SectionHeading icon={TrendingUp} title="Popular right now" />
              <div className="flex flex-col gap-2">
                {posts.map((p) => (
                  <PostCard key={p.id} post={p} currentUserId={viewerId} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function SectionHeading({
  icon: Icon,
  title,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
}) {
  return (
    <h2 className="mb-3 flex items-center gap-2 text-lg font-extrabold">
      <Icon className="h-5 w-5 text-primary" />
      {title}
    </h2>
  );
}
