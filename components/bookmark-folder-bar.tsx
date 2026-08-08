"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { BookmarkFolder } from "@/lib/types";
import { createFolder, deleteFolder, renameFolder } from "@/app/actions/bookmarks";

type DialogKind = null | "new" | "rename" | "delete";

export function BookmarkFolderBar({
  folders,
  activeFolderId,
}: {
  folders: BookmarkFolder[];
  activeFolderId?: string;
}) {
  const router = useRouter();
  const activeFolder = folders.find((f) => f.id === activeFolderId);
  const [dialog, setDialog] = React.useState<DialogKind>(null);
  const [name, setName] = React.useState("");
  const [pending, setPending] = React.useState(false);

  function close() {
    if (!pending) {
      setDialog(null);
    }
  }

  async function onCreate() {
    setPending(true);
    const res = await createFolder(name);
    setPending(false);
    if (res.error) return toast.error(res.error);
    setDialog(null);
    toast.success("Folder created.");
    if (res.folder) router.push(`/bookmarks?folder=${res.folder.id}`);
    router.refresh();
  }

  async function onRename() {
    if (!activeFolder) return;
    setPending(true);
    const res = await renameFolder(activeFolder.id, name);
    setPending(false);
    if (res.error) return toast.error(res.error);
    setDialog(null);
    toast.success("Folder renamed.");
    router.refresh();
  }

  async function onDelete() {
    if (!activeFolder) return;
    setPending(true);
    const res = await deleteFolder(activeFolder.id);
    setPending(false);
    if (res.error) return toast.error(res.error);
    setDialog(null);
    toast.success("Folder deleted — its posts moved to Uncategorized.");
    router.push("/bookmarks");
    router.refresh();
  }

  const chipClass = (active: boolean) =>
    cn(
      "shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
      active
        ? "bg-primary text-primary-foreground"
        : "bg-surface-2 text-muted-foreground hover:text-foreground"
    );

  return (
    <div className="flex items-center gap-2 border-b border-border bg-background px-3 py-2.5">
      <div className="flex flex-1 items-center gap-2 overflow-x-auto">
        <Link href="/bookmarks" className={chipClass(!activeFolderId)}>
          All Bookmarks
        </Link>
        {folders.map((f) => (
          <Link
            key={f.id}
            href={`/bookmarks?folder=${f.id}`}
            className={chipClass(f.id === activeFolderId)}
          >
            {f.name}
          </Link>
        ))}
        <button
          type="button"
          onClick={() => {
            setName("");
            setDialog("new");
          }}
          className="flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
        >
          <Plus className="h-4 w-4" />
          New folder
        </button>
      </div>

      {activeFolder && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-muted-foreground"
              aria-label="Folder options"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                setName(activeFolder.name);
                setDialog("rename");
              }}
            >
              <Pencil className="mr-2 h-4 w-4" />
              Rename folder
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onSelect={(e) => {
                e.preventDefault();
                setDialog("delete");
              }}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete folder
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <Dialog
        open={dialog === "new" || dialog === "rename"}
        onOpenChange={(o) => !o && close()}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialog === "rename" ? "Rename folder" : "New folder"}
            </DialogTitle>
          </DialogHeader>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Folder name"
            maxLength={50}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (dialog === "rename") onRename();
                else onCreate();
              }
            }}
          />
          <DialogFooter>
            <Button variant="outline" onClick={close} disabled={pending}>
              Cancel
            </Button>
            <Button
              onClick={() => (dialog === "rename" ? onRename() : onCreate())}
              disabled={pending || !name.trim()}
            >
              {dialog === "rename" ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === "delete"} onOpenChange={(o) => !o && close()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete folder?</DialogTitle>
            <DialogDescription>
              &ldquo;{activeFolder?.name}&rdquo; will be deleted. The posts inside
              stay saved and move back to Uncategorized.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={close} disabled={pending}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={onDelete} disabled={pending}>
              Delete folder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
