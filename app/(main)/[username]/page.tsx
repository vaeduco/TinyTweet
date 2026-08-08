import { notFound } from "next/navigation";
import { Lock } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import {
  getProfileByUsername,
  getProfileWithStats,
  getUserPosts,
  getUserReplies,
  getUserMediaPosts,
  getLikedPosts,
} from "@/lib/queries";
import { PostCard } from "@/components/post-card";
import { ProfileHeader } from "@/components/profile/profile-header";
import { ProfileTabs, type ProfileTab } from "@/components/profile/profile-tabs";
import type { PostWithAuthor } from "@/lib/types";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  return { title: `@${username}` };
}

const EMPTY: Record<ProfileTab, { title: string; body: string }> = {
  posts: { title: "No posts yet", body: "When they post, it'll show up here." },
  replies: {
    title: "No replies yet",
    body: "Posts they reply to will show up here.",
  },
  media: {
    title: "No media yet",
    body: "Posts with photos or GIFs will show up here.",
  },
  likes: { title: "No likes yet", body: "Posts they like will show up here." },
};

export default async function ProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { username } = await params;
  const { tab } = await searchParams;
  const activeTab: ProfileTab =
    tab === "replies" || tab === "media" || tab === "likes" ? tab : "posts";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const profile = await getProfileByUsername(supabase, username);
  if (!profile) notFound();

  const viewerId = user?.id ?? null;
  const stats = await getProfileWithStats(supabase, profile, viewerId);
  const isOwner = !!user && user.id === profile.id;
  const locked =
    stats.is_private && !isOwner && stats.follow_status !== "accepted";

  let posts: PostWithAuthor[] = [];
  if (!locked) {
    posts =
      activeTab === "replies"
        ? await getUserReplies(supabase, profile.id, viewerId)
        : activeTab === "media"
        ? await getUserMediaPosts(supabase, profile.id, viewerId)
        : activeTab === "likes"
        ? await getLikedPosts(supabase, profile.id, viewerId)
        : await getUserPosts(supabase, profile.id, viewerId);
  }

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
      ) : (
        <>
          <ProfileTabs username={username} active={activeTab} />

          {posts.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <p className="text-lg font-bold">{EMPTY[activeTab].title}</p>
              <p className="mt-1 text-muted-foreground">
                {EMPTY[activeTab].body}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2 p-2">
              {posts.map((p) => (
                <div key={p.id} className="space-y-1">
                  {activeTab === "posts" && p.is_pinned && (
                    <p className="flex items-center gap-1.5 px-1 text-xs font-semibold text-muted-foreground">
                      <span aria-hidden>📌</span> Pinned
                    </p>
                  )}
                  <PostCard post={p} currentUserId={viewerId} />
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
