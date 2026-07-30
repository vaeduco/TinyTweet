"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ToggleSaveResult = { error?: string; saved: boolean };

/** Bookmarks the post if not already saved, otherwise removes the bookmark. */
export async function toggleSave(postId: string): Promise<ToggleSaveResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You must be signed in to save posts.", saved: false };
  }

  const { data: existing } = await supabase
    .from("saved_posts")
    .select("post_id")
    .eq("post_id", postId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("saved_posts")
      .delete()
      .eq("post_id", postId)
      .eq("user_id", user.id);
    if (error) return { error: error.message, saved: true };
    revalidatePath("/saved");
    return { saved: false };
  }

  const { error } = await supabase
    .from("saved_posts")
    .insert({ post_id: postId, user_id: user.id });
  // A concurrent save can race past the SELECT above; the (user_id, post_id)
  // primary key then rejects the duplicate. That means it's already saved —
  // treat it as success, not an error.
  if (error && error.code !== "23505") {
    return { error: error.message, saved: false };
  }
  revalidatePath("/saved");
  return { saved: true };
}
