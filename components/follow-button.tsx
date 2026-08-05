"use client";

import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toggleFollow } from "@/app/actions/follows";
import type { FollowState } from "@/lib/types";

export function FollowButton({
  targetUserId,
  initialStatus,
  size = "default",
  className,
}: {
  targetUserId: string;
  initialStatus: FollowState;
  size?: "sm" | "default";
  className?: string;
}) {
  const [status, setStatus] = React.useState<FollowState>(initialStatus);
  const [pending, setPending] = React.useState(false);
  const [hovering, setHovering] = React.useState(false);

  async function onClick() {
    if (pending) return;
    setPending(true);

    const prev = status;
    // Optimistic: unfollow/cancel -> none; follow -> guess "accepted"
    // (the server corrects it to "pending" for a private account).
    setStatus(prev === "none" ? "accepted" : "none");

    const res = await toggleFollow(targetUserId);
    if (res.error) {
      setStatus(prev);
      toast.error(res.error);
    } else {
      setStatus(res.status);
    }
    setPending(false);
  }

  const off = status === "none";
  let label: string;
  if (status === "accepted") label = hovering ? "Unfollow" : "Following";
  else if (status === "pending") label = hovering ? "Cancel" : "Requested";
  else label = "Follow";

  return (
    <Button
      type="button"
      variant={off ? "default" : "outline"}
      size={size}
      onClick={onClick}
      disabled={pending}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      className={cn(
        "min-w-[104px]",
        !off &&
          "hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive",
        className
      )}
      aria-pressed={!off}
    >
      {label}
    </Button>
  );
}
