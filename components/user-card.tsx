import Link from "next/link";

import { UserAvatar } from "@/components/user-avatar";
import { FollowButton } from "@/components/follow-button";
import { renderContent } from "@/lib/parse";
import type { Profile } from "@/lib/types";

export function UserCard({
  profile,
  currentUserId,
  initialFollowing,
}: {
  profile: Profile;
  currentUserId: string | null;
  initialFollowing: boolean;
}) {
  const profileHref = `/${profile.username}`;
  const showFollow = currentUserId != null && currentUserId !== profile.id;

  return (
    <div className="flex gap-3 rounded-[14px] bg-surface-1 px-3.5 py-2.5 shadow-sm">
      <Link href={profileHref} className="shrink-0" aria-label={profile.username}>
        <UserAvatar profile={profile} className="h-10 w-10" />
      </Link>

      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1 text-sm">
            <Link
              href={profileHref}
              className="block truncate font-semibold hover:underline"
            >
              {profile.display_name || profile.username}
            </Link>
            <Link
              href={profileHref}
              className="block truncate text-muted-foreground hover:underline"
            >
              @{profile.username}
            </Link>
          </div>

          {showFollow && (
            <div className="shrink-0">
              <FollowButton
                targetUserId={profile.id}
                initialFollowing={initialFollowing}
                size="sm"
              />
            </div>
          )}
        </div>

        {profile.bio && (
          <div className="mt-1 line-clamp-2 whitespace-pre-wrap break-anywhere text-sm text-muted-foreground">
            {renderContent(profile.bio)}
          </div>
        )}
      </div>
    </div>
  );
}
