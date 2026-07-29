import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

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

  return (
    <div>
      <div className="sticky top-14 lg:top-0 z-30 flex items-center gap-4 border-b border-border bg-background px-4 py-3">
        <Link
          href="/"
          className="rounded-full p-1 text-foreground transition-colors hover:bg-muted"
          aria-label="Back home"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="min-w-0">
          <h1 className="truncate text-lg font-bold leading-tight">
            {stats.display_name || stats.username}
          </h1>
          <p className="text-sm text-muted-foreground">
            {stats.posts_count} posts
          </p>
        </div>
      </div>

      <ProfileHeader profile={stats} isOwner={isOwner} isAuthed={!!user} />

      {posts.length === 0 ? (
        <div className="px-6 py-16 text-center">
          <p className="text-lg font-bold">No posts yet</p>
          <p className="mt-1 text-muted-foreground">
            When they post, it will show up here.
          </p>
        </div>
      ) : (
        posts.map((p) => (
          <PostCard key={p.id} post={p} currentUserId={user?.id ?? null} />
        ))
      )}
    </div>
  );
}
