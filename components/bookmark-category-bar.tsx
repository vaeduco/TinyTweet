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
import type { BookmarkCategory } from "@/lib/types";
import { createCategory, deleteCategory, renameCategory } from "@/app/actions/bookmarks";

type DialogKind = null | "new" | "rename" | "delete";

export function BookmarkCategoryBar({
  categories,
  activeCategoryId,
}: {
  categories: BookmarkCategory[];
  activeCategoryId?: string;
}) {
  const router = useRouter();
  const activeCategory = categories.find((f) => f.id === activeCategoryId);
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
    const res = await createCategory(name);
    setPending(false);
    if (res.error) return toast.error(res.error);
    setDialog(null);
    toast.success("Category created.");
    if (res.category) router.push(`/bookmarks?category=${res.category.id}`);
    router.refresh();
  }

  async function onRename() {
    if (!activeCategory) return;
    setPending(true);
    const res = await renameCategory(activeCategory.id, name);
    setPending(false);
    if (res.error) return toast.error(res.error);
    setDialog(null);
    toast.success("Category renamed.");
    router.refresh();
  }

  async function onDelete() {
    if (!activeCategory) return;
    setPending(true);
    const res = await deleteCategory(activeCategory.id);
    setPending(false);
    if (res.error) return toast.error(res.error);
    setDialog(null);
    toast.success("Category deleted — its posts moved to Uncategorized.");
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
        <Link href="/bookmarks" className={chipClass(!activeCategoryId)}>
          All Bookmarks
        </Link>
        {categories.map((f) => (
          <Link
            key={f.id}
            href={`/bookmarks?category=${f.id}`}
            className={chipClass(f.id === activeCategoryId)}
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
          New category
        </button>
      </div>

      {activeCategory && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-muted-foreground"
              aria-label="Category options"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                setName(activeCategory.name);
                setDialog("rename");
              }}
            >
              <Pencil className="mr-2 h-4 w-4" />
              Rename category
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onSelect={(e) => {
                e.preventDefault();
                setDialog("delete");
              }}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete category
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
              {dialog === "rename" ? "Rename category" : "New category"}
            </DialogTitle>
          </DialogHeader>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Category name"
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
            <DialogTitle>Delete category?</DialogTitle>
            <DialogDescription>
              &ldquo;{activeCategory?.name}&rdquo; will be deleted. The posts inside
              stay saved and move back to Uncategorized.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={close} disabled={pending}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={onDelete} disabled={pending}>
              Delete category
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
