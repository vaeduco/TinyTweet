"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { MAX_POST_LENGTH } from "@/lib/constants";

export type CreateReplyResult = { error?: string; replyId?: string };

export async function createReply(input: {
  postId: string;
  content: string;
  parentReplyId?: string | null;
  attachmentUrl?: string | null;
  attachmentType?: "image" | "gif" | null;
}): Promise<CreateReplyResult> {
  const content = (input.content ?? "").trim();
  const hasAttachment = !!input.attachmentUrl;

  if (!content && !hasAttachment) return { error: "Your reply can't be empty." };
  if (content.length > MAX_POST_LENGTH) {
    return { error: `Replies are limited to ${MAX_POST_LENGTH} characters.` };
  }
  // Only allow https attachment URLs (blocks javascript:/data: XSS via href).
  if (hasAttachment && !/^https:\/\//i.test(input.attachmentUrl ?? "")) {
    return { error: "Invalid attachment." };
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
      attachment_url: input.attachmentUrl ?? null,
      attachment_type: hasAttachment ? input.attachmentType ?? null : null,
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
