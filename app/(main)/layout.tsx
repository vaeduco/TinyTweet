import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { LeftSidebar } from "@/components/layout/left-sidebar";
import {
  RightSidebar,
  RightSidebarSkeleton,
} from "@/components/layout/right-sidebar";
import { MobileBottomNav, MobileTopBar } from "@/components/layout/mobile-nav";
import type { Profile } from "@/lib/types";

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
  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();
    profile = (data as Profile) ?? null;
  }

  return (
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
  );
}
