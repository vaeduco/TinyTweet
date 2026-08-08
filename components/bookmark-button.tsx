"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Bookmark, Check, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { BookmarkCategory } from "@/lib/types";
import {
  createCategory,
  listCategories,
  removeSave,
  saveToCategory,
} from "@/app/actions/bookmarks";

/**
 * Bookmark toggle with a "Saved in" category picker. Clicking the icon opens a
 * menu of the viewer's categories (Uncategorized + each category); picking one
 * saves/moves the post there. "Create new category" opens a small dialog to
 * name one and immediately files the post into it. A saved post also offers
 * "Remove bookmark". Categories are fetched lazily each time the menu opens.
 */
export function BookmarkButton({
  postId,
  currentUserId,
  initialSaved,
  initialCategoryId,
}: {
  postId: string;
  currentUserId: string | null;
  initialSaved: boolean;
  initialCategoryId: string | null;
}) {
  const router = useRouter();
  const [saved, setSaved] = React.useState(initialSaved);
  const [categoryId, setCategoryId] = React.useState<string | null>(
    initialCategoryId
  );
  const [categories, setCategories] = React.useState<BookmarkCategory[] | null>(
    null
  );
  const [pending, setPending] = React.useState(false);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [newName, setNewName] = React.useState("");

  async function onOpenChange(open: boolean) {
    // Re-fetch every open so a category renamed/deleted elsewhere isn't stale
    // (the old list stays visible during the await, so it doesn't flash empty).
    if (open) setCategories(await listCategories());
  }

  async function save(target: string | null) {
    if (pending) return;
    setPending(true);
    const prev = { saved, categoryId };
    setSaved(true);
    setCategoryId(target);
    const res = await saveToCategory(postId, target);
    if (res.error) {
      setSaved(prev.saved);
      setCategoryId(prev.categoryId);
      toast.error(res.error);
    } else {
      const name = target
        ? categories?.find((c) => c.id === target)?.name ?? "category"
        : "Uncategorized";
      toast.success(`Saved to ${name}.`);
      router.refresh();
    }
    setPending(false);
  }

  async function remove() {
    if (pending) return;
    setPending(true);
    const prev = { saved, categoryId };
    setSaved(false);
    setCategoryId(null);
    const res = await removeSave(postId);
    if (res.error) {
      setSaved(prev.saved);
      setCategoryId(prev.categoryId);
      toast.error(res.error);
    } else {
      toast.success("Bookmark removed.");
      router.refresh();
    }
    setPending(false);
  }

  async function createAndSave() {
    const name = newName.trim();
    if (!name || pending) return;
    setPending(true);
    const res = await createCategory(name);
    if (res.error || !res.category) {
      toast.error(res.error ?? "Couldn't create the category.");
      setPending(false);
      return;
    }
    // The category now exists — reflect it locally and close the dialog before
    // the save leg, so a failed save can't orphan it or duplicate it on retry.
    const cat = res.category;
    setCategories((cs) => [...(cs ?? []), cat]);
    setCreateOpen(false);
    setNewName("");

    const saveRes = await saveToCategory(postId, cat.id);
    setPending(false);
    router.refresh();
    if (saveRes.error) {
      toast.error(`Created “${cat.name}”, but saving failed: ${saveRes.error}`);
      return;
    }
    setSaved(true);
    setCategoryId(cat.id);
    toast.success(`Saved to ${cat.name}.`);
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
    <>
      <DropdownMenu onOpenChange={onOpenChange}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-pressed={saved}
            aria-label={saved ? "Saved — change category" : "Save"}
          >
            {icon}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>{saved ? "Saved in" : "Save to"}</DropdownMenuLabel>
          <CategoryRow
            label="Uncategorized"
            selected={saved && categoryId === null}
            pending={pending}
            onPick={() => save(null)}
          />
          {categories === null ? (
            <div className="flex items-center gap-2 px-2 py-1.5 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : (
            categories.map((c) => (
              <CategoryRow
                key={c.id}
                label={c.name}
                selected={saved && categoryId === c.id}
                pending={pending}
                onPick={() => save(c.id)}
              />
            ))
          )}
          <DropdownMenuItem
            disabled={pending}
            onSelect={() => {
              setNewName("");
              // Defer opening so it doesn't fight the closing menu's focus.
              requestAnimationFrame(() => setCreateOpen(true));
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Create new category
          </DropdownMenuItem>
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

      <Dialog
        open={createOpen}
        onOpenChange={(o) => {
          if (!pending) setCreateOpen(o);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create new category</DialogTitle>
          </DialogHeader>
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Category name"
            maxLength={50}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                createAndSave();
              }
            }}
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button onClick={createAndSave} disabled={pending || !newName.trim()}>
              Create &amp; save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function CategoryRow({
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
