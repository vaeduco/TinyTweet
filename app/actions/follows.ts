"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { FollowState } from "@/lib/types";

export type ToggleFollowResult = { error?: string; status: FollowState };

/**
 * Follow the target if not already following, otherwise unfollow / cancel a
 * request. A follow to a private account is created as a pending request (the
 * DB trigger sets the status); public accounts auto-accept.
 */
export async function toggleFollow(
  targetUserId: string
): Promise<ToggleFollowResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You must be signed in to follow people.", status: "none" };
  }
  if (user.id === targetUserId) {
    return { error: "You can't follow yourself.", status: "none" };
  }

  const { data: existing } = await supabase
    .from("follows")
    .select("status")
    .eq("follower_id", user.id)
    .eq("following_id", targetUserId)
    .maybeSingle();

  if (existing) {
    // Cancelling a request scopes the delete to the pending row. If the owner
    // approved it between our read and now, the delete matches nothing; we
    // re-read and return the real state instead of silently unfollowing.
    let del = supabase
      .from("follows")
      .delete()
      .eq("follower_id", user.id)
      .eq("following_id", targetUserId);
    if (existing.status === "pending") del = del.eq("status", "pending");
    const { data: deleted, error } = await del.select("status");
    if (error) return { error: error.message, status: existing.status };

    if (existing.status === "pending" && (deleted?.length ?? 0) === 0) {
      const { data: current } = await supabase
        .from("follows")
        .select("status")
        .eq("follower_id", user.id)
        .eq("following_id", targetUserId)
        .maybeSingle();
      revalidatePath("/");
      return { status: current?.status ?? "none" };
    }

    revalidatePath("/");
    return { status: "none" };
  }

  const { data: inserted, error } = await supabase
    .from("follows")
    .insert({ follower_id: user.id, following_id: targetUserId })
    .select("status")
    .single();
  if (error) return { error: error.message, status: "none" };
  revalidatePath("/");
  return { status: inserted?.status ?? "accepted" };
}

/** Approve an incoming follow request (owner only). */
export async function approveFollow(
  requesterId: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const { error } = await supabase.rpc("approve_follow", {
    p_requester: requesterId,
  });
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return {};
}

/** Reject / remove an incoming follow request (owner only). */
export async function rejectFollow(
  requesterId: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const { error } = await supabase.rpc("reject_follow", {
    p_requester: requesterId,
  });
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return {};
}
