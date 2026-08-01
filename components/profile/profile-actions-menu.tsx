"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Ban, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { blockUser, unblockUser } from "@/app/actions/settings";

export function ProfileActionsMenu({
  targetId,
  username,
  blockedByMe,
}: {
  targetId: string;
  username: string;
  blockedByMe: boolean;
}) {
  const router = useRouter();
  const [blocked, setBlocked] = React.useState(blockedByMe);
  const [busy, setBusy] = React.useState(false);

  async function toggleBlock() {
    if (busy) return;
    setBusy(true);
    const res = blocked
      ? await unblockUser(targetId)
      : await blockUser(targetId);
    if (res.error) {
      toast.error(res.error);
    } else {
      const next = !blocked;
      setBlocked(next);
      toast.success(next ? `Blocked @${username}.` : `Unblocked @${username}.`);
      router.refresh();
    }
    setBusy(false);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="h-9 w-9 rounded-full"
          aria-label="More options"
        >
          <MoreHorizontal className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          disabled={busy}
          onSelect={(e) => {
            e.preventDefault();
            toggleBlock();
          }}
        >
          <Ban className="mr-2 h-4 w-4" />
          {blocked ? `Unblock @${username}` : `Block @${username}`}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
