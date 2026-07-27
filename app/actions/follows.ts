"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ToggleFollowResult = { error?: string; following: boolean };

/** Follows the target user if not already followed, otherwise unfollows. */
export async function toggleFollow(
  targetUserId: string
): Promise<ToggleFollowResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You must be signed in to follow people.", following: false };
  }
  if (user.id === targetUserId) {
    return { error: "You can't follow yourself.", following: false };
  }

  const { data: existing } = await supabase
    .from("follows")
    .select("following_id")
    .eq("follower_id", user.id)
    .eq("following_id", targetUserId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("follows")
      .delete()
      .eq("follower_id", user.id)
      .eq("following_id", targetUserId);
    if (error) return { error: error.message, following: true };
    revalidatePath("/");
    return { following: false };
  }

  const { error } = await supabase
    .from("follows")
    .insert({ follower_id: user.id, following_id: targetUserId });
  if (error) return { error: error.message, following: false };
  revalidatePath("/");
  return { following: true };
}
