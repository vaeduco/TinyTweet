"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, LogOut, Search, User as UserIcon } from "lucide-react";

import { UserAvatar } from "@/components/user-avatar";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NotificationsNavItem } from "@/components/notifications/notifications-nav-item";
import { MessagesNavItem } from "@/components/messages/messages-nav-item";
import { cn } from "@/lib/utils";
import { APP_NAME } from "@/lib/constants";
import { signOut } from "@/app/auth/actions";
import type { Profile } from "@/lib/types";

/** Sticky top bar for phones/tablets (hidden once the left sidebar appears). */
export function MobileTopBar({ profile }: { profile: Profile | null }) {
  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-2 border-b border-border bg-background px-4 lg:hidden">
      <div className="flex flex-1 items-center justify-start">
        {profile ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                aria-label="Account menu"
                className="rounded-full ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <UserAvatar profile={profile} className="h-8 w-8" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuItem asChild>
                <Link href={`/${profile.username}`}>
                  <UserIcon className="mr-2 h-4 w-4" />
                  Profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  void signOut();
                }}
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button asChild variant="ghost" size="sm">
            <Link href="/login">Log in</Link>
          </Button>
        )}
      </div>

      <Link href="/" className="text-xl" aria-label={APP_NAME}>
        🐦
      </Link>

      <div className="flex flex-1 items-center justify-end gap-1">
        {profile && <NotificationsNavItem variant="icon" />}
        <ThemeToggle />
      </div>
    </header>
  );
}

/** Fixed bottom navigation + compose FAB for phones/tablets. */
export function MobileBottomNav({ profile }: { profile: Profile | null }) {
  const pathname = usePathname();

  return (
    <>
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background lg:hidden"
      >
        <div className="mx-auto flex max-w-md items-center justify-around">
          <BottomLink href="/" label="Home" icon={Home} active={pathname === "/"} />
          <BottomLink
            href="/search"
            label="Search"
            icon={Search}
            active={pathname.startsWith("/search")}
          />
          {profile && <MessagesNavItem variant="bottom" />}
          {profile && (
            <BottomLink
              href={`/${profile.username}`}
              label="Profile"
              icon={UserIcon}
              active={pathname.startsWith(`/${profile.username}`)}
            />
          )}
        </div>
      </nav>
    </>
  );
}

function BottomLink({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex flex-1 flex-col items-center gap-0.5 py-3 transition-colors",
        active ? "text-primary" : "text-muted-foreground"
      )}
      aria-current={active ? "page" : undefined}
    >
      <Icon className="h-6 w-6" />
      <span className="sr-only">{label}</span>
    </Link>
  );
}
