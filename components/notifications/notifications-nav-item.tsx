"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell } from "lucide-react";

import { cn } from "@/lib/utils";
import { useNotifications } from "@/components/notifications/notifications-provider";

function Badge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold leading-none text-primary-foreground">
      {count > 9 ? "9+" : count}
    </span>
  );
}

/** Side-nav / top-bar link to the notifications page, with the unread badge. */
export function NotificationsNavItem({ variant }: { variant: "rail" | "icon" }) {
  const pathname = usePathname();
  const { unreadCount } = useNotifications();
  const active = pathname.startsWith("/notifications");
  const label =
    unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications";

  if (variant === "rail") {
    return (
      <Link
        href="/notifications"
        aria-label={label}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex items-center gap-4 rounded-full px-3 py-2.5 text-xl transition-colors hover:bg-muted",
          active && "font-bold"
        )}
      >
        <span className="relative flex">
          <Bell className="h-6 w-6" />
          <Badge count={unreadCount} />
        </span>
        <span className="sr-only xl:not-sr-only xl:inline">Notifications</span>
      </Link>
    );
  }

  return (
    <Link
      href="/notifications"
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className="relative flex h-9 w-9 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted"
    >
      <Bell className="h-5 w-5" />
      <Badge count={unreadCount} />
    </Link>
  );
}
