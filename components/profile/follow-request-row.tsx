"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { UserAvatar } from "@/components/user-avatar";
import { Button } from "@/components/ui/button";
import { approveFollow, rejectFollow } from "@/app/actions/follows";
import type { Profile } from "@/lib/types";

export function FollowRequestRow({ profile }: { profile: Profile }) {
  const router = useRouter();
  const [resolved, setResolved] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  async function act(kind: "approve" | "reject") {
    if (busy) return;
    setBusy(true);
    const res =
      kind === "approve"
        ? await approveFollow(profile.id)
        : await rejectFollow(profile.id);
    if (res.error) {
      toast.error(res.error);
      setBusy(false);
      return;
    }
    setResolved(true); // drop the row
    toast.success(
      kind === "approve"
        ? `@${profile.username} can now follow you.`
        : `Rejected @${profile.username}.`
    );
    router.refresh();
  }

  if (resolved) return null;

  return (
    <div className="flex items-center gap-3 rounded-[14px] bg-surface-1 px-3.5 py-2.5 shadow-sm">
      <Link href={`/${profile.username}`} className="shrink-0">
        <UserAvatar profile={profile} className="h-10 w-10" />
      </Link>
      <div className="min-w-0 flex-1">
        <Link
          href={`/${profile.username}`}
          className="block truncate text-sm font-semibold hover:underline"
        >
          {profile.display_name || profile.username}
        </Link>
        <p className="truncate text-xs text-muted-foreground">
          @{profile.username}
        </p>
      </div>
      <div className="flex shrink-0 gap-2">
        <Button size="sm" onClick={() => act("approve")} disabled={busy}>
          Approve
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => act("reject")}
          disabled={busy}
        >
          Reject
        </Button>
      </div>
    </div>
  );
}
