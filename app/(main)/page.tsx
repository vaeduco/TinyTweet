import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getFeed } from "@/lib/queries";
import { Feed } from "@/components/feed";
import type { Profile } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profileData } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();
  const profile = (profileData as Profile) ?? null;

  const { posts, relevantAuthorIds } = await getFeed(supabase, user.id);

  return (
    <div>
      <div className="sticky top-14 z-30 border-b border-border bg-background/80 px-4 py-3 backdrop-blur lg:top-0">
        <h1 className="text-xl font-bold">Home</h1>
      </div>
      <Feed
        initialPosts={posts}
        currentUserId={user.id}
        profile={profile}
        relevantAuthorIds={relevantAuthorIds}
      />
    </div>
  );
}
