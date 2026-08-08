"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { Bell, Bookmark, Home, LogOut, Mail, Menu, Settings } from "lucide-react";

import { SearchBar } from "@/components/search-bar";
import { UserAvatar } from "@/components/user-avatar";
import { useNotifications } from "@/components/notifications/notifications-provider";
import { useMessages } from "@/components/messages/messages-provider";
import { signOut } from "@/app/auth/actions";
import { cn } from "@/lib/utils";
import type { Profile } from "@/lib/types";

type LucideIcon = React.ComponentType<{ className?: string }>;

function CountBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span
      aria-hidden="true"
      className="absolute -right-1.5 -top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold leading-none text-primary-foreground"
    >
      {count > 9 ? "9+" : count}
    </span>
  );
}

function MenuRow({
  href,
  label,
  icon: Icon,
  active,
  badge = 0,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
  badge?: number;
}) {
  return (
    <Dialog.Close asChild>
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        aria-label={badge > 0 ? `${label}, ${badge} unread` : undefined}
        className={cn(
          "flex items-center gap-3 rounded-[14px] px-3 py-2.5 text-[15px] transition-colors",
          active
            ? "bg-surface-2 font-semibold"
            : "font-medium hover:bg-surface-2/60"
        )}
      >
        <span className="relative flex">
          <Icon className={cn("h-5 w-5", active && "text-primary")} />
          <CountBadge count={badge} />
        </span>
        <span className="truncate">{label}</span>
      </Link>
    </Dialog.Close>
  );
}

/**
 * Slide-out navigation drawer -- the app's primary nav at every width now that
 * the persistent sidebar is gone. Opened by the hamburger in the top bar, it
 * holds search, the account row, the main links and Sign out. Radix Dialog
 * gives the overlay, focus trap, Escape, scroll-lock and tap-outside-to-close;
 * we add a left slide animation and swipe-left-to-close on top.
 */
export function MobileMenu({ profile }: { profile: Profile }) {
  const [open, setOpen] = React.useState(false);
  const contentRef = React.useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const { unreadCount: unreadNotifications } = useNotifications();
  const { unreadCount: unreadMessages } = useMessages();

  // Close on route change (also covers the search submit, which navigates).
  React.useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Swipe-left past a small threshold closes the drawer -- but only when the
  // gesture is dominantly horizontal, so a vertical scroll that drifts left
  // doesn't dismiss it.
  const touchStart = React.useRef<{ x: number; y: number } | null>(null);
  function onTouchStart(e: React.TouchEvent) {
    const t = e.touches[0];
    touchStart.current = t ? { x: t.clientX, y: t.clientY } : null;
  }
  function onTouchEnd(e: React.TouchEvent) {
    const start = touchStart.current;
    touchStart.current = null;
    const t = e.changedTouches[0];
    if (!start || !t) return;
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (dx < -50 && Math.abs(dx) > Math.abs(dy)) setOpen(false);
  }

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          aria-label="Open menu"
          className="flex h-9 w-9 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <Menu className="h-5 w-5" />
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content
          ref={contentRef}
          tabIndex={-1}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          onOpenAutoFocus={(e) => {
            // Start focus on the panel itself, not the search input -- avoids
            // popping the mobile keyboard and puts a keyboard/SR user at the
            // top of the menu.
            e.preventDefault();
            contentRef.current?.focus();
          }}
          className="fixed inset-y-0 left-0 z-50 flex h-dvh w-[230px] flex-col gap-3 overflow-y-auto border-r border-border bg-surface-1 p-3 shadow-xl outline-none duration-300 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left"
        >
          <Dialog.Title className="sr-only">Navigation menu</Dialog.Title>
          <Dialog.Description className="sr-only">
            Search, your account, and links to the main pages.
          </Dialog.Description>

          <SearchBar onSubmitted={() => setOpen(false)} />

          <Dialog.Close asChild>
            <Link
              href={`/${profile.username}`}
              className="flex items-center gap-3 rounded-[14px] px-2 py-2 transition-colors hover:bg-surface-2/60"
            >
              <UserAvatar profile={profile} className="h-10 w-10 shrink-0" />
              <span className="flex min-w-0 flex-1 flex-col text-sm">
                <span className="truncate font-semibold">
                  {profile.display_name || profile.username}
                </span>
                <span className="truncate text-muted-foreground">
                  @{profile.username}
                </span>
              </span>
            </Link>
          </Dialog.Close>

          <nav aria-label="Menu" className="flex flex-col gap-1">
            <MenuRow href="/" label="Home" icon={Home} active={isActive("/")} />
            <MenuRow
              href="/notifications"
              label="Notifications"
              icon={Bell}
              active={isActive("/notifications")}
              badge={unreadNotifications}
            />
            <MenuRow
              href="/messages"
              label="Messages"
              icon={Mail}
              active={isActive("/messages")}
              badge={unreadMessages}
            />
            <MenuRow
              href="/bookmarks"
              label="Bookmarks"
              icon={Bookmark}
              active={isActive("/bookmarks")}
            />
            <MenuRow
              href="/settings"
              label="Settings"
              icon={Settings}
              active={isActive("/settings")}
            />
          </nav>

          <div className="mt-auto">
            <div className="my-2 border-t border-border" />
            <Dialog.Close asChild>
              <button
                onClick={() => void signOut()}
                className="flex w-full items-center gap-3 rounded-[14px] px-3 py-2.5 text-[15px] font-medium text-destructive transition-colors hover:bg-destructive/10"
              >
                <LogOut className="h-5 w-5" />
                Sign out
              </button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
