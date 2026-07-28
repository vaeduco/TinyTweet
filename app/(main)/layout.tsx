import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { getNotifications, getUnreadNotificationCount } from "@/lib/queries";
import { NotificationsProvider } from "@/components/notifications/notifications-provider";
import { LeftSidebar } from "@/components/layout/left-sidebar";
import {
  RightSidebar,
  RightSidebarSkeleton,
} from "@/components/layout/right-sidebar";
import { MobileBottomNav, MobileTopBar } from "@/components/layout/mobile-nav";
import type { NotificationWithActor, Profile } from "@/lib/types";

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let profile: Profile | null = null;
  let initialNotifications: NotificationWithActor[] = [];
  let initialUnread = 0;

  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();
    profile = (data as Profile) ?? null;

    [initialNotifications, initialUnread] = await Promise.all([
      getNotifications(supabase, user.id),
      getUnreadNotificationCount(supabase, user.id),
    ]);
  }

  return (
    <NotificationsProvider
      userId={user?.id ?? null}
      initialNotifications={initialNotifications}
      initialUnread={initialUnread}
    >
      <div className="min-h-screen">
        <MobileTopBar profile={profile} />

        <div className="mx-auto flex w-full max-w-[1290px] justify-center">
          <LeftSidebar profile={profile} />

          <main className="min-h-screen w-full min-w-0 max-w-[600px] border-x border-border pb-24 lg:pb-0">
            {children}
          </main>

          <Suspense fallback={<RightSidebarSkeleton />}>
            <RightSidebar viewerId={user?.id ?? null} />
          </Suspense>
        </div>

        <MobileBottomNav profile={profile} />
      </div>
    </NotificationsProvider>
  );
}
