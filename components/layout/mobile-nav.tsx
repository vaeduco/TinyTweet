"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, LogOut, PenSquare, Search, User as UserIcon } from "lucide-react";

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
import { ComposeDialog } from "@/components/layout/compose-dialog";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { cn } from "@/lib/utils";
import { APP_NAME } from "@/lib/constants";
import { signOut } from "@/app/auth/actions";
import type { Profile } from "@/lib/types";

/** Sticky top bar for phones/tablets (hidden once the left sidebar appears). */
export function MobileTopBar({ profile }: { profile: Profile | null }) {
  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-2 border-b border-border bg-background/80 px-4 backdrop-blur lg:hidden">
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
        {profile && <NotificationBell variant="icon" />}
        <ThemeToggle />
      </div>
    </header>
  );
}

/** Fixed bottom navigation + compose FAB for phones/tablets. */
export function MobileBottomNav({ profile }: { profile: Profile | null }) {
  const pathname = usePathname();

  const items = [
    { href: "/", label: "Home", icon: Home },
    { href: "/search", label: "Search", icon: Search },
    ...(profile
      ? [{ href: `/${profile.username}`, label: "Profile", icon: UserIcon }]
      : []),
  ];

  return (
    <>
      {profile && (
        <div className="fixed bottom-20 right-4 z-40 lg:hidden">
          <ComposeDialog
            profile={profile}
            trigger={
              <Button
                className="h-14 w-14 rounded-full p-0 shadow-lg"
                aria-label="Post"
              >
                <PenSquare className="h-6 w-6" />
              </Button>
            }
          />
        </div>
      )}

      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur lg:hidden"
      >
        <div className="mx-auto flex max-w-md items-center justify-around">
          {items.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-1 flex-col items-center gap-0.5 py-3 transition-colors",
                  active ? "text-primary" : "text-muted-foreground"
                )}
                aria-current={active ? "page" : undefined}
              >
                <Icon className="h-6 w-6" />
                <span className="sr-only">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
