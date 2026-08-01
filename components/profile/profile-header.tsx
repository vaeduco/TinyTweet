import Link from "next/link";
import { Calendar } from "lucide-react";

import { UserAvatar } from "@/components/user-avatar";
import { Button } from "@/components/ui/button";
import { FollowButton } from "@/components/follow-button";
import { MessageButton } from "@/components/messages/message-button";
import { EditProfileDialog } from "@/components/profile/edit-profile-dialog";
import { ProfileCover } from "@/components/profile/profile-cover";
import { PresenceStatus } from "@/components/presence/presence-status";
import { renderContent } from "@/lib/parse";
import type { ProfileWithStats } from "@/lib/types";

export function ProfileHeader({
  profile,
  isOwner,
  isAuthed,
}: {
  profile: ProfileWithStats;
  isOwner: boolean;
  isAuthed: boolean;
}) {
  const joined = new Date(profile.created_at).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="border-b border-border">
      <ProfileCover
        coverUrl={profile.cover_url}
        userId={profile.id}
        isOwner={isOwner}
      />

      <div className="px-4 pb-4">
        <div className="-mt-10 flex items-end justify-between">
          <UserAvatar
            profile={profile}
            className="h-20 w-20 border-4 border-background"
          />
          {isOwner ? (
            <EditProfileDialog profile={profile} />
          ) : isAuthed ? (
            <div className="flex items-center gap-2">
              <MessageButton targetId={profile.id} />
              <FollowButton
                targetUserId={profile.id}
                initialFollowing={profile.followed_by_me}
              />
            </div>
          ) : (
            <Button asChild variant="default">
              <Link href="/login">Follow</Link>
            </Button>
          )}
        </div>

        <div className="mt-3">
          <h2 className="text-xl font-bold">
            {profile.display_name || profile.username}
          </h2>
          <p className="text-muted-foreground">@{profile.username}</p>
          {!isOwner && (
            <PresenceStatus
              userId={profile.id}
              lastSeenAt={profile.last_seen_at}
              className="mt-1"
            />
          )}
        </div>

        {profile.bio && (
          <p className="mt-3 whitespace-pre-wrap break-anywhere text-[15px] leading-normal">
            {renderContent(profile.bio)}
          </p>
        )}

        <div className="mt-3 flex items-center gap-1.5 text-sm text-muted-foreground">
          <Calendar className="h-4 w-4" />
          <span>Joined {joined}</span>
        </div>

        <div className="mt-3 flex gap-5 text-sm">
          <span>
            <b className="font-semibold text-foreground">
              {profile.following_count}
            </b>{" "}
            <span className="text-muted-foreground">Following</span>
          </span>
          <span>
            <b className="font-semibold text-foreground">
              {profile.followers_count}
            </b>{" "}
            <span className="text-muted-foreground">Followers</span>
          </span>
        </div>
      </div>
    </div>
  );
}
