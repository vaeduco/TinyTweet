"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Search, X } from "lucide-react";
import { toast } from "sonner";

import { UserAvatar } from "@/components/user-avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createConversation } from "@/app/actions/messages";
import type { Profile } from "@/lib/types";

export function NewMessage({ followed }: { followed: Profile[] }) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [selected, setSelected] = React.useState<Profile[]>([]);
  const [groupName, setGroupName] = React.useState("");
  const [creating, setCreating] = React.useState(false);

  const selectedIds = new Set(selected.map((p) => p.id));
  const q = query.trim().toLowerCase();
  const filtered = followed.filter(
    (p) =>
      !selectedIds.has(p.id) &&
      (!q ||
        p.username.toLowerCase().includes(q) ||
        (p.display_name ?? "").toLowerCase().includes(q))
  );
  const isGroup = selected.length > 1;

  async function start() {
    if (selected.length === 0 || creating) return;
    setCreating(true);
    const res = await createConversation({
      targetIds: selected.map((p) => p.id),
      isGroup,
      name: isGroup ? groupName : null,
    });
    if (res.error || !res.conversationId) {
      toast.error(res.error ?? "Could not start the conversation.");
      setCreating(false);
      return;
    }
    router.push(`/messages/${res.conversationId}`);
  }

  return (
    <div>
      <div className="sticky top-14 z-20 flex items-center gap-4 border-b border-border bg-background/80 px-4 py-3 backdrop-blur lg:top-0">
        <Link
          href="/messages"
          className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Back to inbox"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="flex-1 text-xl font-bold">New message</h1>
        <Button size="sm" onClick={start} disabled={selected.length === 0 || creating}>
          {creating && <Loader2 className="h-4 w-4 animate-spin" />}
          {isGroup ? "Create group" : "Chat"}
        </Button>
      </div>

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2 border-b border-border px-4 py-3">
          {selected.map((p) => (
            <span
              key={p.id}
              className="flex items-center gap-1.5 rounded-full bg-muted py-1 pl-1 pr-2 text-sm"
            >
              <UserAvatar profile={p} className="h-5 w-5" />
              <span className="max-w-[8rem] truncate">
                {p.display_name || p.username}
              </span>
              <button
                type="button"
                onClick={() => setSelected((s) => s.filter((x) => x.id !== p.id))}
                aria-label={`Remove ${p.username}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}

      {isGroup && (
        <div className="border-b border-border px-4 py-3">
          <Input
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder="Group name (optional)"
            maxLength={60}
          />
        </div>
      )}

      <div className="border-b border-border px-4 py-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search people you follow"
            className="rounded-full bg-muted pl-9"
            autoFocus
          />
        </div>
      </div>

      {followed.length === 0 ? (
        <p className="px-6 py-12 text-center text-sm text-muted-foreground">
          You can message anyone you follow — follow some people first.
        </p>
      ) : filtered.length === 0 ? (
        <p className="px-6 py-12 text-center text-sm text-muted-foreground">
          No matches.
        </p>
      ) : (
        filtered.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => {
              setSelected((s) => [...s, p]);
              setQuery("");
            }}
            className="flex w-full items-center gap-3 border-b border-border px-4 py-3 text-left transition-colors hover:bg-muted/40"
          >
            <UserAvatar profile={p} className="h-10 w-10" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">
                {p.display_name || p.username}
              </p>
              <p className="truncate text-sm text-muted-foreground">
                @{p.username}
              </p>
            </div>
          </button>
        ))
      )}
    </div>
  );
}
