"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

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
import { notificationText } from "@/lib/notification-text";
import { playPing } from "@/lib/sound";
import { BoundedSet } from "@/lib/bounded-set";

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
  const router = useRouter();
  const supabase = React.useMemo(() => createClient(), []);
  const [notifications, setNotifications] =
    React.useState<NotificationWithActor[]>(initialNotifications);
  const [unreadCount, setUnreadCount] = React.useState(initialUnread);

  // Synchronous de-dupe so two redelivered rows can't both pass the (async)
  // guard and double-toast/ping/count before either commits to state.
  const seenRef = React.useRef(new BoundedSet());
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
          // Ignore rows we already handled — realtime can redeliver on
          // reconnect. This check is synchronous (before the await) so two
          // rapid redeliveries can't both slip through and double-alert.
          if (seenRef.current.has(row.id)) return;
          seenRef.current.add(row.id);
          if (notifsRef.current.some((n) => n.id === row.id)) return;

          const { data: actor } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", row.actor_id)
            .single();
          if (!actor || !active) return;

          const enriched: NotificationWithActor = {
            ...row,
            actor: actor as Profile,
          };
          setNotifications((prev) =>
            prev.some((n) => n.id === row.id)
              ? prev
              : [enriched, ...prev].slice(0, MAX_KEPT)
          );
          if (!row.is_read) setUnreadCount((c) => c + 1);

          // Brief in-app alert (tappable to jump) + a subtle sound.
          const { body, url } = notificationText(enriched);
          toast(body, {
            action: { label: "View", onClick: () => router.push(url) },
          });
          playPing();
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
  }, [supabase, userId, router]);

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
