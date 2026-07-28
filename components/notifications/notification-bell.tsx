"use client";

import * as React from "react";
import Link from "next/link";
import { AtSign, Bell, Heart, MessageCircle, UserPlus } from "lucide-react";

import { UserAvatar } from "@/components/user-avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { NotificationType, NotificationWithActor } from "@/lib/types";
import { useNotifications } from "@/components/notifications/notifications-provider";

const ACTION_TEXT: Record<NotificationType, string> = {
  follow: "followed you",
  like: "liked your post",
  reply: "replied to your post",
  mention: "mentioned you",
};

function TypeIcon({ type }: { type: NotificationType }) {
  const common = "h-4 w-4";
  switch (type) {
    case "follow":
      return <UserPlus className={cn(common, "text-primary")} />;
    case "like":
      return <Heart className={cn(common, "fill-current text-rose-500")} />;
    case "reply":
      return <MessageCircle className={cn(common, "text-primary")} />;
    case "mention":
      return <AtSign className={cn(common, "text-primary")} />;
  }
}

function UnreadBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold leading-none text-primary-foreground">
      {count > 9 ? "9+" : count}
    </span>
  );
}

function NotificationRow({
  n,
  onSelect,
}: {
  n: NotificationWithActor;
  onSelect: () => void;
}) {
  const href = n.reference_id ? `/post/${n.reference_id}` : `/${n.actor.username}`;
  const name = n.actor.display_name || n.actor.username;

  return (
    <DropdownMenuItem asChild onSelect={onSelect} className="p-0">
      <Link
        href={href}
        className={cn(
          "flex w-full cursor-pointer items-start gap-3 px-4 py-3",
          !n.is_read && "bg-primary/5"
        )}
      >
        <span className="relative shrink-0">
          <UserAvatar profile={n.actor} className="h-9 w-9" />
          <span className="absolute -bottom-1 -right-1 rounded-full bg-background p-0.5">
            <TypeIcon type={n.type} />
          </span>
        </span>
        <span className="min-w-0 flex-1 text-sm">
          <span className="break-anywhere">
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
            aria-hidden
          />
        )}
      </Link>
    </DropdownMenuItem>
  );
}

export function NotificationBell({ variant }: { variant: "rail" | "icon" }) {
  const { notifications, unreadCount, markRead, markAllRead } =
    useNotifications();

  const ariaLabel =
    unreadCount > 0
      ? `Notifications, ${unreadCount} unread`
      : "Notifications";

  const trigger =
    variant === "rail" ? (
      <button
        aria-label={ariaLabel}
        className="flex items-center gap-4 rounded-full px-3 py-2.5 text-xl transition-colors hover:bg-muted"
      >
        <span className="relative flex">
          <Bell className="h-6 w-6" />
          <UnreadBadge count={unreadCount} />
        </span>
        <span className="sr-only xl:not-sr-only xl:inline">Notifications</span>
      </button>
    ) : (
      <button
        aria-label={ariaLabel}
        className="relative flex h-9 w-9 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted"
      >
        <Bell className="h-5 w-5" />
        <UnreadBadge count={unreadCount} />
      </button>
    );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent
        align={variant === "rail" ? "start" : "end"}
        side={variant === "rail" ? "right" : "bottom"}
        sideOffset={8}
        className="max-h-[70vh] w-80 max-w-[calc(100vw-1.5rem)] overflow-y-auto p-0"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-popover px-4 py-3">
          <span className="text-base font-bold">Notifications</span>
          {unreadCount > 0 && (
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                markAllRead();
              }}
              className="h-auto cursor-pointer rounded px-2 py-1 text-sm font-medium text-primary hover:underline focus:bg-accent focus:text-primary"
            >
              Mark all as read
            </DropdownMenuItem>
          )}
        </div>

        {notifications.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <Bell className="mx-auto h-6 w-6 text-muted-foreground" />
            <p className="mt-2 text-sm font-semibold">No notifications yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Likes, replies, follows and mentions will show up here.
            </p>
          </div>
        ) : (
          <div>
            {notifications.map((n) => (
              <NotificationRow
                key={n.id}
                n={n}
                onSelect={() => markRead(n.id)}
              />
            ))}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
