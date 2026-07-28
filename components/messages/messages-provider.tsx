"use client";

import * as React from "react";

import { createClient } from "@/lib/supabase/client";
import { markConversationRead } from "@/app/actions/messages";
import type { Message } from "@/lib/types";

type MessagesContextValue = {
  enabled: boolean;
  unreadCount: number;
  isUnread: (conversationId: string) => boolean;
  /** Marks the currently-open conversation so incoming messages don't badge it. */
  setActiveConversation: (conversationId: string | null) => void;
  /** Clears a conversation's unread state (optimistic) and persists last_read_at. */
  markRead: (conversationId: string) => void;
};

const MessagesContext = React.createContext<MessagesContextValue | null>(null);

export function useMessages(): MessagesContextValue {
  return (
    React.useContext(MessagesContext) ?? {
      enabled: false,
      unreadCount: 0,
      isUnread: () => false,
      setActiveConversation: () => {},
      markRead: () => {},
    }
  );
}

export function MessagesProvider({
  userId,
  initialUnreadIds,
  children,
}: {
  userId: string | null;
  initialUnreadIds: string[];
  children: React.ReactNode;
}) {
  const supabase = React.useMemo(() => createClient(), []);
  const [unread, setUnread] = React.useState<Set<string>>(
    () => new Set(initialUnreadIds)
  );
  const activeRef = React.useRef<string | null>(null);

  const removeUnread = React.useCallback((conversationId: string) => {
    setUnread((prev) => {
      if (!prev.has(conversationId)) return prev;
      const next = new Set(prev);
      next.delete(conversationId);
      return next;
    });
  }, []);

  const markRead = React.useCallback(
    (conversationId: string) => {
      removeUnread(conversationId);
      void markConversationRead(conversationId);
    },
    [removeUnread]
  );

  const setActiveConversation = React.useCallback(
    (conversationId: string | null) => {
      activeRef.current = conversationId;
      if (conversationId) removeUnread(conversationId);
    },
    [removeUnread]
  );

  React.useEffect(() => {
    if (!userId) return;

    // RLS scopes this stream to messages in the viewer's own conversations.
    const channel = supabase
      .channel(`messages-inbox-${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const row = payload.new as Message;
          if (row.sender_id === userId) return; // my own message
          if (row.conversation_id === activeRef.current) {
            // I'm currently viewing it — keep it read.
            void markConversationRead(row.conversation_id);
            return;
          }
          setUnread((prev) => {
            if (prev.has(row.conversation_id)) return prev;
            const next = new Set(prev);
            next.add(row.conversation_id);
            return next;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, userId]);

  const value = React.useMemo<MessagesContextValue>(
    () => ({
      enabled: !!userId,
      unreadCount: unread.size,
      isUnread: (id) => unread.has(id),
      setActiveConversation,
      markRead,
    }),
    [userId, unread, setActiveConversation, markRead]
  );

  return (
    <MessagesContext.Provider value={value}>
      {children}
    </MessagesContext.Provider>
  );
}
