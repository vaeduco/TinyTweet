"use client";

import Link from "next/link";
import { AtSign, Bell, Heart, MessageCircle, UserPlus } from "lucide-react";

import { UserAvatar } from "@/components/user-avatar";
import { Button } from "@/components/ui/button";
import { formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { NotificationType, NotificationWithActor } from "@/lib/types";
import { useNotifications } from "@/components/notifications/notifications-provider";

const ACTION_TEXT: Record<NotificationType, string> = {
  follow: "followed you",
  follow_request: "requested to follow you",
  like: "liked your post",
  reply: "replied to your post",
  mention: "mentioned you",
};

function TypeIcon({ type }: { type: NotificationType }) {
  const common = "h-4 w-4";
  switch (type) {
    case "follow":
    case "follow_request":
      return <UserPlus className={cn(common, "text-primary")} />;
    case "like":
      return <Heart className={cn(common, "fill-current text-rose-500")} />;
    case "reply":
      return <MessageCircle className={cn(common, "text-primary")} />;
    case "mention":
      return <AtSign className={cn(common, "text-primary")} />;
  }
}

function NotificationRow({
  n,
  onSelect,
}: {
  n: NotificationWithActor;
  onSelect: () => void;
}) {
  const href =
    n.type === "follow_request"
      ? "/follow-requests"
      : n.reference_id
      ? `/post/${n.reference_id}`
      : `/${n.actor.username}`;
  const name = n.actor.display_name || n.actor.username;

  return (
    <Link
      href={href}
      onClick={onSelect}
      className={cn(
        "flex items-start gap-3 rounded-[14px] px-3.5 py-2.5 shadow-sm transition-colors",
        n.is_read
          ? "bg-surface-1 hover:bg-surface-2/40"
          : "bg-primary/5 hover:bg-primary/10"
      )}
    >
      <span className="relative shrink-0">
        <UserAvatar profile={n.actor} className="h-10 w-10" />
        <span className="absolute -bottom-1 -right-1 rounded-full bg-surface-1 p-0.5">
          <TypeIcon type={n.type} />
        </span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="break-anywhere text-[15px]">
          <span className="font-semibold">{name}</span>{" "}
          <span className="text-muted-foreground">{ACTION_TEXT[n.type]}</span>
        </span>
        <span className="mt-0.5 block text-xs text-muted-foreground">
          {formatRelativeTime(n.created_at)}
        </span>
      </span>
      {!n.is_read && (
        <span
          className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary"
          aria-label="Unread"
        />
      )}
    </Link>
  );
}

export function NotificationsView() {
  const { notifications, unreadCount, markRead, markAllRead } =
    useNotifications();

  return (
    <div>
      <div className="sticky top-14 z-30 flex items-center justify-between gap-3 border-b border-border bg-background px-4 py-3">
        <h1 className="text-xl font-bold">Notifications</h1>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => markAllRead()}
          disabled={unreadCount === 0}
          className="shrink-0 text-primary hover:text-primary disabled:opacity-40"
        >
          Mark all as read
        </Button>
      </div>

      {notifications.length === 0 ? (
        <div className="px-6 py-16 text-center">
          <Bell className="mx-auto h-7 w-7 text-muted-foreground" />
          <p className="mt-3 text-lg font-bold">No notifications yet</p>
          <p className="mx-auto mt-1 max-w-xs text-muted-foreground">
            Likes, replies, follows and mentions will show up here.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2 p-2">
          {notifications.map((n) => (
            <NotificationRow
              key={n.id}
              n={n}
              onSelect={() => markRead(n.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
