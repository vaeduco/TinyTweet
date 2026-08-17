import Link from "next/link";
import { redirect } from "next/navigation";
import { Users } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { getFeed, getFollowingFeed, getWhoToFollow } from "@/lib/queries";
import { Feed } from "@/components/feed";
import { EmptyState } from "@/components/empty-state";
import { SuggestedFollows } from "@/components/suggested-follows";
import { cn } from "@/lib/utils";
import type { Profile } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { tab } = await searchParams;
  const activeTab = tab === "following" ? "following" : "for-you";

  const { data: profileData } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();
  const profile = (profileData as Profile) ?? null;

  const { posts, relevantAuthorIds } =
    activeTab === "following"
      ? await getFollowingFeed(supabase, user.id)
      : await getFeed(supabase, user.id);

  // A user who follows nobody sees only their own posts echoed back in
  // "Following"; treat that as empty so the discovery nudge still reaches them
  // even after they've posted. (relevantAuthorIds is [self, ...following].)
  const followsNobody =
    activeTab === "following" && relevantAuthorIds.length <= 1;
  const shownPosts = followsNobody ? [] : posts;
  const followingEmpty = activeTab === "following" && shownPosts.length === 0;

  // Surface suggestions right in the empty state so a new user can start
  // following without leaving Home.
  const suggestions = followingEmpty
    ? await getWhoToFollow(supabase, user.id, 5)
    : [];

  return (
    <div>
      <div className="sticky top-14 z-30 bg-background">
        <div className="border-b border-border px-4 py-3">
          <h1 className="text-xl font-bold">Home</h1>
        </div>
        <nav aria-label="Feed" className="flex border-b border-border">
          <FeedTab label="For you" tab="for-you" active={activeTab === "for-you"} />
          <FeedTab
            label="Following"
            tab="following"
            active={activeTab === "following"}
          />
        </nav>
      </div>

      <Feed
        key={activeTab}
        initialPosts={shownPosts}
        currentUserId={user.id}
        profile={profile}
        relevantAuthorIds={relevantAuthorIds}
        emptyState={
          activeTab === "following" ? (
            <EmptyState
              icon={Users}
              title="Your feed is quiet"
              description="Follow people to see their posts here."
            >
              {suggestions.length > 0 && (
                <div className="mx-auto w-full max-w-md">
                  <SuggestedFollows
                    suggestions={suggestions}
                    currentUserId={user.id}
                    heading={
                      <p className="mb-2 px-1 text-left text-sm font-bold">
                        Suggested for you
                      </p>
                    }
                  />
                </div>
              )}
            </EmptyState>
          ) : undefined
        }
      />
    </div>
  );
}

function FeedTab({
  label,
  tab,
  active,
}: {
  label: string;
  tab: "for-you" | "following";
  active: boolean;
}) {
  return (
    <Link
      href={tab === "for-you" ? "/" : "/?tab=following"}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex-1 py-3 text-center text-sm font-medium transition-colors hover:bg-muted/40",
        active
          ? "border-b-2 border-primary text-foreground"
          : "text-muted-foreground"
      )}
    >
      {label}
    </Link>
  );
}
