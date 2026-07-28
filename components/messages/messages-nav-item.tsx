"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Mail } from "lucide-react";

import { cn } from "@/lib/utils";
import { useMessages } from "@/components/messages/messages-provider";

function Badge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold leading-none text-primary-foreground">
      {count > 9 ? "9+" : count}
    </span>
  );
}

export function MessagesNavItem({ variant }: { variant: "rail" | "bottom" }) {
  const pathname = usePathname();
  const { unreadCount } = useMessages();
  const active = pathname.startsWith("/messages");
  const label =
    unreadCount > 0 ? `Messages, ${unreadCount} unread` : "Messages";

  if (variant === "rail") {
    return (
      <Link
        href="/messages"
        aria-label={label}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex items-center gap-4 rounded-full px-3 py-2.5 text-xl transition-colors hover:bg-muted",
          active && "font-bold"
        )}
      >
        <span className="relative flex">
          <Mail className="h-6 w-6" />
          <Badge count={unreadCount} />
        </span>
        <span className="sr-only xl:not-sr-only xl:inline">Messages</span>
      </Link>
    );
  }

  return (
    <Link
      href="/messages"
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex flex-1 flex-col items-center gap-0.5 py-3 transition-colors",
        active ? "text-primary" : "text-muted-foreground"
      )}
    >
      <span className="relative flex">
        <Mail className="h-6 w-6" />
        <Badge count={unreadCount} />
      </span>
      <span className="sr-only">Messages</span>
    </Link>
  );
}
