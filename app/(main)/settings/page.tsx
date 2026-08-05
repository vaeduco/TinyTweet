import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { getBlockedProfiles, getFollowRequests } from "@/lib/queries";
import { AccountSection } from "@/components/settings/account-section";
import { PrivacySection } from "@/components/settings/privacy-section";
import { NotificationSection } from "@/components/settings/notification-section";
import { AppearanceSection } from "@/components/settings/appearance-section";
import type { Profile } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profileData } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();
  const profile = profileData as Profile;
  const [blocked, requests] = await Promise.all([
    getBlockedProfiles(supabase, user.id),
    getFollowRequests(supabase, user.id),
  ]);

  return (
    <div>
      <div className="sticky top-14 z-30 flex items-center gap-4 border-b border-border bg-background px-4 py-3 lg:top-0">
        <Link
          href={`/${profile.username}`}
          className="rounded-full p-1 text-foreground transition-colors hover:bg-muted"
          aria-label="Back to profile"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-xl font-bold">Settings</h1>
      </div>

      <div className="flex flex-col gap-2 p-2">
        <AccountSection profile={profile} email={user.email ?? ""} />
        <PrivacySection
          profile={profile}
          blocked={blocked}
          requestCount={requests.length}
        />
        <NotificationSection profile={profile} />
        <AppearanceSection />
      </div>
    </div>
  );
}
