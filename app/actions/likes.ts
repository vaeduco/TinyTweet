"use server";

import { createClient } from "@/lib/supabase/server";

export type ToggleLikeResult = { error?: string; liked: boolean };

/** Likes the post if not already liked, otherwise unlikes it. */
export async function toggleLike(postId: string): Promise<ToggleLikeResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in to like posts.", liked: false };

  const { data: existing } = await supabase
    .from("likes")
    .select("post_id")
    .eq("post_id", postId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("likes")
      .delete()
      .eq("post_id", postId)
      .eq("user_id", user.id);
    if (error) return { error: error.message, liked: true };
    return { liked: false };
  }

  const { error } = await supabase
    .from("likes")
    .insert({ post_id: postId, user_id: user.id });
  // A concurrent like can race past the SELECT above; the (user_id, post_id)
  // primary key then rejects the duplicate. That means it's already liked —
  // treat it as success, not an error.
  if (error && error.code !== "23505") {
    return { error: error.message, liked: false };
  }
  return { liked: true };
}
