"use client";

import * as React from "react";

import { createClient } from "@/lib/supabase/client";
import type {
  Notification,
  NotificationWithActor,
  Profile,
} from "@/lib/types";
import {
  markAllNotificationsRead,
  markNotificationRead,
} from "@/app/actions/notifications";
import { getNotifications, getUnreadNotificationCount } from "@/lib/queries";

type NotificationsContextValue = {
  enabled: boolean;
  notifications: NotificationWithActor[];
  unreadCount: number;
  markRead: (id: string) => void;
  markAllRead: () => void;
};

const NotificationsContext =
  React.createContext<NotificationsContextValue | null>(null);

export function useNotifications(): NotificationsContextValue {
  return (
    React.useContext(NotificationsContext) ?? {
      enabled: false,
      notifications: [],
      unreadCount: 0,
      markRead: () => {},
      markAllRead: () => {},
    }
  );
}

const MAX_KEPT = 50;

export function NotificationsProvider({
  userId,
  initialNotifications,
  initialUnread,
  children,
}: {
  userId: string | null;
  initialNotifications: NotificationWithActor[];
  initialUnread: number;
  children: React.ReactNode;
}) {
  const supabase = React.useMemo(() => createClient(), []);
  const [notifications, setNotifications] =
    React.useState<NotificationWithActor[]>(initialNotifications);
  const [unreadCount, setUnreadCount] = React.useState(initialUnread);

  // Keep a ref of current notifications for read-state checks without
  // re-creating the callbacks on every change.
  const notifsRef = React.useRef(notifications);
  React.useEffect(() => {
    notifsRef.current = notifications;
  }, [notifications]);

  React.useEffect(() => {
    if (!userId) return;

    let active = true;

    // Refetch authoritative state on (re)subscribe — closes the gap between the
    // SSR snapshot and the live socket, and heals any events missed during a
    // websocket drop (postgres_changes does not backfill).
    const reconcile = async () => {
      const [fresh, unread] = await Promise.all([
        getNotifications(supabase, userId),
        getUnreadNotificationCount(supabase, userId),
      ]);
      if (!active) return;
      setNotifications(fresh);
      setUnreadCount(unread);
    };

    const channel = supabase
      .channel(`notifications-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        async (payload) => {
          const row = payload.new as Notification;
          // Ignore rows we already have — realtime can redeliver on reconnect,
          // and the count must not double-increment.
          if (notifsRef.current.some((n) => n.id === row.id)) return;

          const { data: actor } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", row.actor_id)
            .single();
          if (!actor || !active) return;

          setNotifications((prev) =>
            prev.some((n) => n.id === row.id)
              ? prev
              : [{ ...row, actor: actor as Profile }, ...prev].slice(0, MAX_KEPT)
          );
          if (!row.is_read) setUnreadCount((c) => c + 1);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const old = payload.old as { id?: string; is_read?: boolean };
          if (!old?.id) return;
          setNotifications((prev) => prev.filter((n) => n.id !== old.id));
          if (old.is_read === false) {
            setUnreadCount((c) => Math.max(0, c - 1));
          }
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") void reconcile();
      });

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [supabase, userId]);

  const markRead = React.useCallback((id: string) => {
    const target = notifsRef.current.find((n) => n.id === id);
    if (!target || target.is_read) return; // unknown or already read → no-op

    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
    setUnreadCount((c) => Math.max(0, c - 1));
    void markNotificationRead(id);
  }, []);

  const markAllRead = React.useCallback(() => {
    if (notifsRef.current.every((n) => n.is_read) && unreadCount === 0) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
    void markAllNotificationsRead();
  }, [unreadCount]);

  const value = React.useMemo<NotificationsContextValue>(
    () => ({
      enabled: !!userId,
      notifications,
      unreadCount,
      markRead,
      markAllRead,
    }),
    [userId, notifications, unreadCount, markRead, markAllRead]
  );

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
}
