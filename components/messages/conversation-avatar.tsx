import { Users } from "lucide-react";

import { UserAvatar } from "@/components/user-avatar";
import { cn } from "@/lib/utils";
import type { Profile } from "@/lib/types";

export function ConversationAvatar({
  avatars,
  isGroup,
  className,
  ringClassName = "border-background",
}: {
  avatars: Profile[];
  isGroup: boolean;
  className?: string;
  /** Border color for the overlapping group avatars — match the surface they
   * sit on (the page vs. a card). */
  ringClassName?: string;
}) {
  if (avatars.length === 0) {
    return (
      <div
        className={cn(
          "flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-muted",
          className
        )}
      >
        <Users className="h-5 w-5 text-muted-foreground" />
      </div>
    );
  }

  if (isGroup && avatars.length > 1) {
    return (
      <div className={cn("relative h-11 w-11 shrink-0", className)}>
        <UserAvatar
          profile={avatars[0]}
          className={cn("absolute left-0 top-0 h-8 w-8 border-2", ringClassName)}
        />
        <UserAvatar
          profile={avatars[1]}
          className={cn("absolute bottom-0 right-0 h-8 w-8 border-2", ringClassName)}
        />
      </div>
    );
  }

  return <UserAvatar profile={avatars[0]} className={cn("h-11 w-11 shrink-0", className)} />;
}
