"use client";

import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toggleFollow } from "@/app/actions/follows";

export function FollowButton({
  targetUserId,
  initialFollowing,
  size = "default",
  className,
}: {
  targetUserId: string;
  initialFollowing: boolean;
  size?: "sm" | "default";
  className?: string;
}) {
  const [following, setFollowing] = React.useState(initialFollowing);
  const [pending, setPending] = React.useState(false);
  const [hovering, setHovering] = React.useState(false);

  async function onClick() {
    if (pending) return;
    setPending(true);

    const prev = following;
    setFollowing(!prev); // optimistic

    const res = await toggleFollow(targetUserId);
    if (res.error) {
      setFollowing(prev);
      toast.error(res.error);
    } else {
      setFollowing(res.following);
    }
    setPending(false);
  }

  const label = following ? (hovering ? "Unfollow" : "Following") : "Follow";

  return (
    <Button
      type="button"
      variant={following ? "outline" : "default"}
      size={size}
      onClick={onClick}
      disabled={pending}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      className={cn(
        "min-w-[104px]",
        following &&
          "hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive",
        className
      )}
      aria-pressed={following}
    >
      {label}
    </Button>
  );
}
