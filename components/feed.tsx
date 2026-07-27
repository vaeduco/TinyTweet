"use client";

import * as React from "react";

import { PostCard } from "@/components/post-card";
import { ComposeBox } from "@/components/compose-box";
import { createClient } from "@/lib/supabase/client";
import type { Post, PostWithAuthor, Profile } from "@/lib/types";

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

          const { data: author } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", row.user_id)
            .single();
          if (!author) return;

          setPosts((prev) =>
            prev.some((p) => p.id === row.id)
              ? prev
              : [
                  { ...row, author: author as Profile, liked_by_me: false },
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
  }, [supabase, relevantSet]);

  return (
    <div>
      {profile && currentUserId && (
        <ComposeBox profile={profile} onPosted={prepend} />
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
        posts.map((post) => (
          <PostCard key={post.id} post={post} currentUserId={currentUserId} />
        ))
      )}
    </div>
  );
}
