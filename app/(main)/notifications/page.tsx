import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { NotificationsView } from "@/components/notifications/notifications-view";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // The list + unread state come from the NotificationsProvider (realtime),
  // mounted in the (main) layout.
  return <NotificationsView />;
}
