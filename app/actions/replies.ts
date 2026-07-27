"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { MAX_POST_LENGTH } from "@/lib/constants";

export type CreateReplyResult = { error?: string; replyId?: string };

export async function createReply(input: {
  postId: string;
  content: string;
  parentReplyId?: string | null;
}): Promise<CreateReplyResult> {
  const content = (input.content ?? "").trim();

  if (!content) return { error: "Your reply can't be empty." };
  if (content.length > MAX_POST_LENGTH) {
    return { error: `Replies are limited to ${MAX_POST_LENGTH} characters.` };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in to reply." };

  const { data, error } = await supabase
    .from("replies")
    .insert({
      post_id: input.postId,
      user_id: user.id,
      content,
      parent_reply_id: input.parentReplyId ?? null,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  revalidatePath(`/post/${input.postId}`);
  revalidatePath("/");
  return { replyId: data.id };
}

export async function deleteReply(
  replyId: string,
  postId: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const { error } = await supabase
    .from("replies")
    .delete()
    .eq("id", replyId)
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  revalidatePath(`/post/${postId}`);
  return {};
}
