"use client";

import * as React from "react";

import { PostCard } from "@/components/post-card";
import { ComposeBox } from "@/components/compose-box";
import { createClient } from "@/lib/supabase/client";
import type {
  Poll,
  PollOption,
  PollWithMeta,
  Post,
  PostWithAuthor,
  Profile,
} from "@/lib/types";

/** Load a streamed-in post's poll (if any) so it renders fully in the feed. */
async function fetchPollForPost(
  supabase: ReturnType<typeof createClient>,
  postId: string,
  viewerId: string | null
): Promise<PollWithMeta | null> {
  const { data: pollRow } = await supabase
    .from("polls")
    .select("*")
    .eq("post_id", postId)
    .maybeSingle();
  if (!pollRow) return null;
  const poll = pollRow as Poll;

  const { data: optRows } = await supabase
    .from("poll_options")
    .select("*")
    .eq("poll_id", poll.id)
    .order("position", { ascending: true });
  const options = (optRows ?? []) as PollOption[];

  let myVote: string | null = null;
  if (viewerId) {
    const { data: vote } = await supabase
      .from("poll_votes")
      .select("option_id")
      .eq("poll_id", poll.id)
      .eq("user_id", viewerId)
      .maybeSingle();
    myVote = vote?.option_id ?? null;
  }

  return {
    ...poll,
    options,
    my_vote_option_id: myVote,
    total_votes: options.reduce((sum, o) => sum + o.vote_count, 0),
  };
}

export function Feed({
  initialPosts,
  currentUserId,
  profile,
  relevantAuthorIds,
}: {
  initialPosts: PostWithAuthor[];
  currentUserId: string | null;
  profile: Profile | null;
  /** Author ids whose new posts should stream into this feed (self + following). */
  relevantAuthorIds: string[];
}) {
  const supabase = React.useMemo(() => createClient(), []);
  const [posts, setPosts] = React.useState<PostWithAuthor[]>(initialPosts);

  const relevantSet = React.useMemo(
    () => new Set(relevantAuthorIds),
    [relevantAuthorIds]
  );

  const prepend = React.useCallback((post: PostWithAuthor) => {
    setPosts((prev) =>
      prev.some((p) => p.id === post.id) ? prev : [post, ...prev]
    );
  }, []);

  // Merge server refreshes (e.g. after posting from the compose modal, which
  // calls router.refresh()) into state, without dropping optimistic/realtime
  // additions. New server posts are added by id; existing ones are untouched.
  React.useEffect(() => {
    setPosts((prev) => {
      const byId = new Map(prev.map((p) => [p.id, p]));
      let added = false;
      for (const p of initialPosts) {
        if (!byId.has(p.id)) {
          byId.set(p.id, p);
          added = true;
        }
      }
      if (!added) return prev;
      return Array.from(byId.values()).sort((a, b) =>
        a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0
      );
    });
  }, [initialPosts]);

  // Realtime: stream new posts from relevant authors into the feed.
  React.useEffect(() => {
    const channel = supabase
      .channel("feed-posts")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "posts" },
        async (payload) => {
          const row = payload.new as Post;
          if (!relevantSet.has(row.user_id)) return;

          const [{ data: author }, poll] = await Promise.all([
            supabase.from("profiles").select("*").eq("id", row.user_id).single(),
            fetchPollForPost(supabase, row.id, currentUserId),
          ]);
          if (!author) return;

          setPosts((prev) =>
            prev.some((p) => p.id === row.id)
              ? prev
              : [
                  {
                    ...row,
                    author: author as Profile,
                    liked_by_me: false,
                    saved_by_me: false,
                    poll,
                  },
                  ...prev,
                ]
          );
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "posts" },
        (payload) => {
          const oldRow = payload.old as { id?: string };
          if (!oldRow?.id) return;
          setPosts((prev) => prev.filter((p) => p.id !== oldRow.id));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, relevantSet, currentUserId]);

  return (
    <div>
      {profile && currentUserId && (
        <div className="p-2">
          <ComposeBox profile={profile} onPosted={prepend} />
        </div>
      )}

      {posts.length === 0 ? (
        <div className="px-6 py-16 text-center">
          <p className="text-lg font-semibold">Your feed is quiet</p>
          <p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground">
            Share your first thought above, or find people to follow from the
            search page.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2 p-2">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} currentUserId={currentUserId} />
          ))}
        </div>
      )}
    </div>
  );
}
