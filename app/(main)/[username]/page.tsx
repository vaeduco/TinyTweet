import { notFound } from "next/navigation";
import { Lock } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import {
  getProfileByUsername,
  getProfileWithStats,
  getUserPosts,
} from "@/lib/queries";
import { PostCard } from "@/components/post-card";
import { ProfileHeader } from "@/components/profile/profile-header";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  return { title: `@${username}` };
}

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const profile = await getProfileByUsername(supabase, username);
  if (!profile) notFound();

  const stats = await getProfileWithStats(supabase, profile, user?.id ?? null);
  const posts = await getUserPosts(supabase, profile.id, user?.id ?? null);
  const isOwner = !!user && user.id === profile.id;

  const locked =
    stats.is_private && !isOwner && stats.follow_status !== "accepted";

  return (
    <div>
      <ProfileHeader profile={stats} isOwner={isOwner} isAuthed={!!user} />

      {locked ? (
        <div className="px-6 py-16 text-center">
          <Lock className="mx-auto h-7 w-7 text-muted-foreground" />
          <p className="mt-3 text-lg font-bold">This account is private</p>
          <p className="mx-auto mt-1 max-w-xs text-muted-foreground">
            {stats.follow_status === "pending"
              ? "Your follow request is pending — you'll see their posts once it's approved."
              : "Follow this account to see their posts."}
          </p>
        </div>
      ) : posts.length === 0 ? (
        <div className="px-6 py-16 text-center">
          <p className="text-lg font-bold">No posts yet</p>
          <p className="mt-1 text-muted-foreground">
            When they post, it will show up here.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2 p-2">
          {posts.map((p) => (
            <PostCard key={p.id} post={p} currentUserId={user?.id ?? null} />
          ))}
        </div>
      )}
    </div>
  );
}
