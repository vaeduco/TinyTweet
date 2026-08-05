"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bookmark,
  Home,
  LogOut,
  MoreHorizontal,
  PenSquare,
  Search,
  Settings,
  User as UserIcon,
} from "lucide-react";

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
import { MobileMenu } from "@/components/layout/mobile-menu";
import { cn } from "@/lib/utils";
import { APP_NAME } from "@/lib/constants";
import { signOut } from "@/app/auth/actions";
import type { Profile } from "@/lib/types";

type LucideIcon = React.ComponentType<{ className?: string }>;

function NavRow({
  href,
  label,
  icon: Icon,
  active,
  disabled,
  title,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  active?: boolean;
  disabled?: boolean;
  title?: string;
}) {
  const inner = (
    <span
      className={cn(
        "flex items-center gap-4 rounded-full px-3 py-2.5 text-xl transition-colors",
        active ? "font-bold" : "font-normal",
        disabled
          ? "cursor-default text-muted-foreground/60"
          : "hover:bg-muted"
      )}
    >
      <Icon className="h-6 w-6" />
      <span className="sr-only xl:not-sr-only xl:inline">{label}</span>
    </span>
  );

  if (disabled) {
    return (
      <div title={title} aria-disabled>
        {inner}
      </div>
    );
  }
  return (
    <Link href={href} title={label} aria-current={active ? "page" : undefined}>
      {inner}
    </Link>
  );
}

export function LeftSidebar({ profile }: { profile: Profile | null }) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <nav
      aria-label="Primary"
      className="sticky top-0 hidden h-dvh shrink-0 flex-col justify-between overflow-y-auto px-2 py-3 lg:flex lg:w-[88px] xl:w-[275px]"
    >
      <div className="flex flex-col items-center gap-1 xl:items-stretch">
        <Link
          href="/"
          className="mb-1 flex items-center gap-2 rounded-full px-3 py-2 text-2xl font-bold transition-colors hover:bg-muted"
          aria-label={APP_NAME}
        >
          <span aria-hidden>🐦</span>
          <span className="hidden xl:inline">{APP_NAME}</span>
        </Link>

        {profile && <MobileMenu profile={profile} variant="sidebar" />}
        <NavRow href="/" label="Home" icon={Home} active={isActive("/")} />
        <NavRow
          href="/search"
          label="Search"
          icon={Search}
          active={isActive("/search")}
        />
        {profile && <NotificationsNavItem variant="rail" />}
        {profile && <MessagesNavItem variant="rail" />}
        {profile && (
          <NavRow
            href={`/${profile.username}`}
            label="Profile"
            icon={UserIcon}
            active={pathname === `/${profile.username}`}
          />
        )}

        {!profile && (
          <div className="mt-3 flex w-full flex-col gap-2 xl:w-full">
            <Button asChild className="h-11 w-11 p-0 xl:w-full xl:px-6">
              <Link href="/signup" aria-label="Sign up">
                <PenSquare className="h-5 w-5 xl:hidden" />
                <span className="hidden xl:inline">Sign up</span>
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="hidden xl:inline-flex xl:w-full"
            >
              <Link href="/login">Log in</Link>
            </Button>
          </div>
        )}
      </div>

      <div className="flex flex-col items-center gap-1 xl:items-stretch">
        <div className="flex justify-center xl:justify-start xl:px-1">
          <ThemeToggle />
        </div>

        {profile && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                aria-label="Account menu"
                className="flex items-center justify-center gap-3 rounded-full p-2 transition-colors hover:bg-muted xl:w-full xl:justify-start"
              >
                <UserAvatar profile={profile} className="h-9 w-9 shrink-0" />
                <span className="hidden min-w-0 flex-1 flex-col text-sm xl:flex">
                  <span className="truncate text-left font-semibold">
                    {profile.display_name || profile.username}
                  </span>
                  <span className="truncate text-left text-muted-foreground">
                    @{profile.username}
                  </span>
                </span>
                <MoreHorizontal className="hidden h-5 w-5 shrink-0 xl:block" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="top" className="w-56">
              <DropdownMenuItem asChild>
                <Link href={`/${profile.username}`}>
                  <UserIcon className="mr-2 h-4 w-4" />
                  Profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/saved">
                  <Bookmark className="mr-2 h-4 w-4" />
                  Saved
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/settings">
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
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
        )}
      </div>
    </nav>
  );
}
