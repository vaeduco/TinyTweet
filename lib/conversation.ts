import type { Conversation, Profile } from "@/lib/types";

export type ConversationDisplay = {
  title: string;
  handle: string | null; // @username for 1-on-1; null for groups
  avatars: Profile[]; // one for direct chats, up to two stacked for groups
  isGroup: boolean;
};

/**
 * Resolve how a conversation should be titled/pictured for a viewer.
 * `others` = participants excluding the viewer.
 */
export function conversationDisplay(
  conv: Pick<Conversation, "is_group" | "name">,
  others: Profile[],
  allParticipants: Profile[] = []
): ConversationDisplay {
  if (conv.is_group) {
    const names = others.map((p) => p.display_name || p.username);
    const title = conv.name?.trim() || names.join(", ") || "Group chat";
    return { title, handle: null, avatars: others.slice(0, 2), isGroup: true };
  }

  // Direct chat: the other person (or yourself, for a self-conversation edge case).
  const other = others[0] ?? allParticipants[0];
  if (!other) {
    return { title: "Conversation", handle: null, avatars: [], isGroup: false };
  }
  return {
    title: other.display_name || other.username,
    handle: other.username,
    avatars: [other],
    isGroup: false,
  };
}
