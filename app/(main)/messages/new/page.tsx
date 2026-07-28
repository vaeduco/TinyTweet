import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getFollowedProfiles } from "@/lib/queries";
import { NewMessage } from "@/components/messages/new-message";

export const dynamic = "force-dynamic";
export const metadata = { title: "New message" };

export default async function NewMessagePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const followed = await getFollowedProfiles(supabase, user.id);

  return <NewMessage followed={followed} />;
}
