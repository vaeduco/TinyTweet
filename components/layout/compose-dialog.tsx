"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ComposeBox } from "@/components/compose-box";
import type { Profile } from "@/lib/types";

export function ComposeDialog({
  profile,
  trigger,
}: {
  profile: Profile;
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="top-24 translate-y-0 gap-0 overflow-hidden p-0 sm:top-[12%]">
        <DialogHeader className="sr-only">
          <DialogTitle>Compose post</DialogTitle>
        </DialogHeader>
        <ComposeBox
          profile={profile}
          autoFocus
          placeholder="What's happening?"
          onPosted={() => {
            setOpen(false);
            router.refresh();
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
