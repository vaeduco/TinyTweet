"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, Home, User as UserIcon } from "lucide-react";

import { UserAvatar } from "@/components/user-avatar";
import { Button } from "@/components/ui/button";
import { NotificationsNavItem } from "@/components/notifications/notifications-nav-item";
import { MessagesNavItem } from "@/components/messages/messages-nav-item";
import { MobileMenu } from "@/components/layout/mobile-menu";
import { ComposeModalButton } from "@/components/compose-modal";
import { cn } from "@/lib/utils";
import { APP_NAME } from "@/lib/constants";
import type { Profile } from "@/lib/types";

/**
 * Sticky top bar shown at ALL widths. The hamburger (MobileMenu) in the
 * top-left is the sole persistent nav chrome now that the left sidebar is gone;
 * it opens the slide-out drawer on demand. The mobile bottom nav still coexists
 * below `lg`.
 */
export function TopBar({ profile }: { profile: Profile | null }) {
  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-2 border-b border-border bg-background px-4">
      <div className="flex flex-1 items-center justify-start gap-1">
        {profile && <MobileMenu profile={profile} />}
        {profile ? (
          <Link
            href={`/${profile.username}`}
            aria-label="Your profile"
            className="rounded-full ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <UserAvatar profile={profile} className="h-8 w-8" />
          </Link>
        ) : (
          <Button asChild variant="ghost" size="sm">
            <Link href="/login">Log in</Link>
          </Button>
        )}
      </div>

      <Link href="/" className="text-lg font-bold tracking-tight">
        {APP_NAME}
      </Link>

      <div className="flex flex-1 items-center justify-end gap-1">
        {profile && <NotificationsNavItem variant="icon" />}
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
            href="/explore"
            label="Explore"
            icon={Compass}
            active={
              pathname.startsWith("/explore") || pathname.startsWith("/search")
            }
          />
          {profile && <ComposeModalButton profile={profile} />}
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
