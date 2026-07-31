"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ComposeBox } from "@/components/compose-box";
import type { Profile } from "@/lib/types";

/**
 * The raised "+" compose action for the mobile bottom nav. It fills a nav slot
 * and floats a filled circular button above the bar; tapping it opens the
 * composer in a modal.
 */
export function ComposeModalButton({ profile }: { profile: Profile }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label="Create post"
          className="flex flex-1 items-center justify-center py-3"
        >
          <span className="flex h-12 w-12 -translate-y-3 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg ring-4 ring-background transition-transform hover:scale-105 active:scale-95">
            <Plus className="h-6 w-6" />
          </span>
        </button>
      </DialogTrigger>

      <DialogContent className="top-[10%] translate-y-0 gap-2 p-3 sm:max-w-lg">
        <DialogTitle className="px-1 pt-1 text-base font-semibold">
          Create post
        </DialogTitle>
        <ComposeBox
          profile={profile}
          autoFocus
          onDone={() => {
            setOpen(false);
            router.push("/");
            router.refresh();
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
