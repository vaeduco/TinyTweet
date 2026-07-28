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

/** Recipient marks others' undelivered messages in a conversation as delivered. */
export async function markConversationDelivered(
  conversationId: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("messages")
    .update({ status: "delivered" })
    .eq("conversation_id", conversationId)
    .neq("sender_id", user.id)
    .eq("status", "sent");
  if (error) return { error: error.message };
  return {};
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

// ---- Per-user conversation options ----

const MAX_PINNED = 3;

async function updateOwnParticipant(
  conversationId: string,
  patch: {
    is_archived?: boolean;
    deleted_at?: string | null;
    is_muted?: boolean;
    is_pinned?: boolean;
    pinned_at?: string | null;
    last_read_at?: string;
  }
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("conversation_participants")
    .update(patch)
    .eq("conversation_id", conversationId)
    .eq("user_id", user.id);
  if (error) return { error: error.message };

  revalidatePath("/messages");
  return {};
}

export async function setConversationArchived(
  conversationId: string,
  archived: boolean
): Promise<{ error?: string }> {
  return updateOwnParticipant(conversationId, { is_archived: archived });
}

export async function setConversationMuted(
  conversationId: string,
  muted: boolean
): Promise<{ error?: string }> {
  return updateOwnParticipant(conversationId, { is_muted: muted });
}

/** Soft-delete for this user only; a new message will bring it back. */
export async function deleteConversation(
  conversationId: string
): Promise<{ error?: string }> {
  return updateOwnParticipant(conversationId, {
    deleted_at: new Date().toISOString(),
  });
}

export async function markConversationUnread(
  conversationId: string
): Promise<{ error?: string }> {
  // Reset last_read_at so the unread indicator returns (epoch = definitely old).
  return updateOwnParticipant(conversationId, {
    last_read_at: new Date(0).toISOString(),
  });
}

export async function setConversationPinned(
  conversationId: string,
  pinned: boolean
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  if (pinned) {
    const { count } = await supabase
      .from("conversation_participants")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("is_pinned", true)
      .is("deleted_at", null);
    if ((count ?? 0) >= MAX_PINNED) {
      return { error: `You can pin up to ${MAX_PINNED} conversations.` };
    }
  }

  return updateOwnParticipant(conversationId, {
    is_pinned: pinned,
    pinned_at: pinned ? new Date().toISOString() : null,
  });
}

/** Leave a group: remove only your own participant row. */
export async function leaveConversation(
  conversationId: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Leaving is for groups only; direct chats use soft-delete instead.
  const { data: conv } = await supabase
    .from("conversations")
    .select("is_group")
    .eq("id", conversationId)
    .maybeSingle();
  if (!conv?.is_group) {
    return { error: "You can only leave group conversations." };
  }

  const { error } = await supabase
    .from("conversation_participants")
    .delete()
    .eq("conversation_id", conversationId)
    .eq("user_id", user.id);
  if (error) return { error: error.message };

  revalidatePath("/messages");
  return {};
}
