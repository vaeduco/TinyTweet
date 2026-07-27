"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { MAX_POST_LENGTH } from "@/lib/constants";

export type CreatePostResult = { error?: string; postId?: string };

export async function createPost(input: {
  content: string;
  imageUrl?: string | null;
}): Promise<CreatePostResult> {
  const content = (input.content ?? "").trim();

  if (!content) return { error: "Your post can't be empty." };
  if (content.length > MAX_POST_LENGTH) {
    return { error: `Posts are limited to ${MAX_POST_LENGTH} characters.` };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in to post." };

  const { data, error } = await supabase
    .from("posts")
    .insert({ user_id: user.id, content, image_url: input.imageUrl ?? null })
    .select("id")
    .single();

  if (error) return { error: error.message };

  revalidatePath("/");
  return { postId: data.id };
}

export async function deletePost(postId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  // RLS also enforces ownership; the extra filter is defense in depth.
  const { error } = await supabase
    .from("posts")
    .delete()
    .eq("id", postId)
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/");
  return {};
}
