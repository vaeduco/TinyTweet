"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function createConversation(input: {
  targetIds: string[];
  isGroup?: boolean;
  name?: string | null;
}): Promise<{ error?: string; conversationId?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const targets = (input.targetIds ?? []).filter((id) => id && id !== user.id);
  if (targets.length === 0) {
    return { error: "Choose at least one person to message." };
  }

  const { data, error } = await supabase.rpc("create_conversation", {
    target_ids: targets,
    is_group_in: !!input.isGroup || targets.length > 1,
    group_name: input.name?.trim() || null,
  });
  if (error) return { error: error.message };
  if (!data) return { error: "Could not start the conversation." };

  revalidatePath("/messages");
  return { conversationId: data };
}

export async function sendMessage(input: {
  conversationId: string;
  content: string;
}): Promise<{ error?: string; messageId?: string }> {
  const content = (input.content ?? "").trim();
  if (!content) return { error: "Message can't be empty." };
  if (content.length > 2000) return { error: "Message is too long." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const { data, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: input.conversationId,
      sender_id: user.id,
      content,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  // Sending implies you've read the conversation.
  await supabase
    .from("conversation_participants")
    .update({ last_read_at: new Date().toISOString() })
    .eq("conversation_id", input.conversationId)
    .eq("user_id", user.id);

  return { messageId: data.id };
}

export async function markConversationRead(
  conversationId: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("conversation_participants")
    .update({ last_read_at: new Date().toISOString() })
    .eq("conversation_id", conversationId)
    .eq("user_id", user.id);
  if (error) return { error: error.message };
  return {};
}

export async function addParticipants(input: {
  conversationId: string;
  targetIds: string[];
}): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const ids = (input.targetIds ?? []).filter(Boolean);
  if (ids.length === 0) return { error: "No one to add." };

  const { error } = await supabase.rpc("add_participants", {
    conv: input.conversationId,
    add_ids: ids,
  });
  if (error) return { error: error.message };

  revalidatePath(`/messages/${input.conversationId}`);
  return {};
}
