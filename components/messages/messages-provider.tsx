"use client";

import * as React from "react";

import { createClient } from "@/lib/supabase/client";
import {
  markConversationDelivered,
  markConversationRead,
  markConversationUnread,
  setConversationMuted,
} from "@/app/actions/messages";
import type { Message } from "@/lib/types";

type MessagesContextValue = {
  enabled: boolean;
  unreadCount: number; // unread AND not muted — drives the nav badge
  isUnread: (conversationId: string) => boolean;
  isMuted: (conversationId: string) => boolean;
  setActiveConversation: (conversationId: string | null) => void;
  markRead: (conversationId: string) => void;
  markUnread: (conversationId: string) => void;
  setMuted: (conversationId: string, muted: boolean) => void;
  /** Drop a conversation from client state (on delete / leave). */
  forget: (conversationId: string, opts?: { keepMuted?: boolean }) => void;
};

const MessagesContext = React.createContext<MessagesContextValue | null>(null);

export function useMessages(): MessagesContextValue {
  return (
    React.useContext(MessagesContext) ?? {
      enabled: false,
      unreadCount: 0,
      isUnread: () => false,
      isMuted: () => false,
      setActiveConversation: () => {},
      markRead: () => {},
      markUnread: () => {},
      setMuted: () => {},
      forget: () => {},
    }
  );
}

export function MessagesProvider({
  userId,
  initialUnreadIds,
  initialMutedIds,
  children,
}: {
  userId: string | null;
  initialUnreadIds: string[];
  initialMutedIds: string[];
  children: React.ReactNode;
}) {
  const supabase = React.useMemo(() => createClient(), []);
  const [unread, setUnread] = React.useState<Set<string>>(
    () => new Set(initialUnreadIds)
  );
  const [muted, setMutedSet] = React.useState<Set<string>>(
    () => new Set(initialMutedIds)
  );
  const activeRef = React.useRef<string | null>(null);

  const removeFrom = React.useCallback(
    (setter: React.Dispatch<React.SetStateAction<Set<string>>>, id: string) => {
      setter((prev) => {
        if (!prev.has(id)) return prev;
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    },
    []
  );
  const addTo = React.useCallback(
    (setter: React.Dispatch<React.SetStateAction<Set<string>>>, id: string) => {
      setter((prev) => {
        if (prev.has(id)) return prev;
        const next = new Set(prev);
        next.add(id);
        return next;
      });
    },
    []
  );

  const markRead = React.useCallback(
    (id: string) => {
      removeFrom(setUnread, id);
      void markConversationRead(id);
    },
    [removeFrom]
  );
  const markUnread = React.useCallback(
    (id: string) => {
      addTo(setUnread, id);
      void markConversationUnread(id);
    },
    [addTo]
  );
  const setMuted = React.useCallback(
    (id: string, isMutedNext: boolean) => {
      if (isMutedNext) addTo(setMutedSet, id);
      else removeFrom(setMutedSet, id);
      void setConversationMuted(id, isMutedNext);
    },
    [addTo, removeFrom]
  );
  const forget = React.useCallback(
    (id: string, opts?: { keepMuted?: boolean }) => {
      removeFrom(setUnread, id);
      // Soft-delete keeps the row (and its muted flag) on the server, so keep
      // it in the client muted set too — an undelete must not badge a muted chat.
      if (!opts?.keepMuted) removeFrom(setMutedSet, id);
    },
    [removeFrom]
  );
  const setActiveConversation = React.useCallback(
    (id: string | null) => {
      activeRef.current = id;
      if (id) removeFrom(setUnread, id);
    },
    [removeFrom]
  );

  React.useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`messages-inbox-${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const row = payload.new as Message;
          if (row.sender_id === userId) return;
          void markConversationDelivered(row.conversation_id);
          if (row.conversation_id === activeRef.current) {
            void markConversationRead(row.conversation_id);
            return;
          }
          addTo(setUnread, row.conversation_id);
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, userId, addTo]);

  const unreadCount = React.useMemo(() => {
    let n = 0;
    for (const id of unread) if (!muted.has(id)) n++;
    return n;
  }, [unread, muted]);

  const value = React.useMemo<MessagesContextValue>(
    () => ({
      enabled: !!userId,
      unreadCount,
      isUnread: (id) => unread.has(id),
      isMuted: (id) => muted.has(id),
      setActiveConversation,
      markRead,
      markUnread,
      setMuted,
      forget,
    }),
    [
      userId,
      unreadCount,
      unread,
      muted,
      setActiveConversation,
      markRead,
      markUnread,
      setMuted,
      forget,
    ]
  );

  return (
    <MessagesContext.Provider value={value}>
      {children}
    </MessagesContext.Provider>
  );
}
