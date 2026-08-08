"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Bookmark, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { BookmarkFolder } from "@/lib/types";
import { listFolders, removeSave, saveToFolder } from "@/app/actions/bookmarks";

/**
 * Bookmark toggle with a folder picker. Clicking the icon opens a menu of the
 * viewer's folders (Uncategorized + each folder); picking one saves/moves the
 * post there, and a saved post also offers "Remove bookmark". Folders are
 * fetched lazily the first time the menu opens.
 */
export function BookmarkButton({
  postId,
  currentUserId,
  initialSaved,
  initialFolderId,
}: {
  postId: string;
  currentUserId: string | null;
  initialSaved: boolean;
  initialFolderId: string | null;
}) {
  const router = useRouter();
  const [saved, setSaved] = React.useState(initialSaved);
  const [folderId, setFolderId] = React.useState<string | null>(initialFolderId);
  const [folders, setFolders] = React.useState<BookmarkFolder[] | null>(null);
  const [pending, setPending] = React.useState(false);

  async function onOpenChange(open: boolean) {
    // Re-fetch every open so a folder renamed/deleted elsewhere isn't stale
    // (the old list stays visible during the await, so it doesn't flash empty).
    if (open) setFolders(await listFolders());
  }

  async function save(target: string | null) {
    if (pending) return;
    setPending(true);
    const prev = { saved, folderId };
    setSaved(true);
    setFolderId(target);
    const res = await saveToFolder(postId, target);
    if (res.error) {
      setSaved(prev.saved);
      setFolderId(prev.folderId);
      toast.error(res.error);
    } else {
      const name = target
        ? folders?.find((f) => f.id === target)?.name ?? "folder"
        : "Uncategorized";
      toast.success(`Saved to ${name}.`);
      router.refresh();
    }
    setPending(false);
  }

  async function remove() {
    if (pending) return;
    setPending(true);
    const prev = { saved, folderId };
    setSaved(false);
    setFolderId(null);
    const res = await removeSave(postId);
    if (res.error) {
      setSaved(prev.saved);
      setFolderId(prev.folderId);
      toast.error(res.error);
    } else {
      toast.success("Bookmark removed.");
      router.refresh();
    }
    setPending(false);
  }

  const icon = (
    <span
      className={cn(
        "group flex items-center gap-1.5 rounded-full text-sm text-muted-foreground transition-colors hover:text-primary",
        saved && "text-primary"
      )}
    >
      <span className="rounded-full p-1.5 group-hover:bg-primary/10">
        <Bookmark className={cn("h-[18px] w-[18px]", saved && "fill-current")} />
      </span>
    </span>
  );

  if (!currentUserId) {
    return (
      <button
        type="button"
        aria-label="Save"
        onClick={() => toast.error("Sign in to save posts.")}
      >
        {icon}
      </button>
    );
  }

  return (
    <DropdownMenu onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-pressed={saved}
          aria-label={saved ? "Saved — change folder" : "Save"}
        >
          {icon}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>{saved ? "Saved in" : "Save to"}</DropdownMenuLabel>
        <FolderRow
          label="Uncategorized"
          selected={saved && folderId === null}
          pending={pending}
          onPick={() => save(null)}
        />
        {folders === null ? (
          <div className="flex items-center gap-2 px-2 py-1.5 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : (
          folders.map((f) => (
            <FolderRow
              key={f.id}
              label={f.name}
              selected={saved && folderId === f.id}
              pending={pending}
              onPick={() => save(f.id)}
            />
          ))
        )}
        {saved && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              disabled={pending}
              onSelect={() => remove()}
            >
              Remove bookmark
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function FolderRow({
  label,
  selected,
  pending,
  onPick,
}: {
  label: string;
  selected: boolean;
  pending: boolean;
  onPick: () => void;
}) {
  return (
    <DropdownMenuItem disabled={pending} onSelect={() => onPick()}>
      <span className="flex-1 truncate">{label}</span>
      {selected && <Check className="ml-2 h-4 w-4 shrink-0 text-primary" />}
    </DropdownMenuItem>
  );
}
