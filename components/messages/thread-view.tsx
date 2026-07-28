"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, SendHorizontal, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { UserAvatar } from "@/components/user-avatar";
import { ConversationAvatar } from "@/components/messages/conversation-avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import { useMessages } from "@/components/messages/messages-provider";
import { getMessages } from "@/lib/queries";
import { conversationDisplay } from "@/lib/conversation";
import { formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type {
  Conversation,
  Message,
  MessageWithSender,
  Profile,
} from "@/lib/types";
import {
  addParticipants,
  markConversationDelivered,
  sendMessage,
} from "@/app/actions/messages";

export function ThreadView({
  conversation,
  participants,
  initialMessages,
  currentUserId,
  addableProfiles,
}: {
  conversation: Conversation;
  participants: Profile[];
  initialMessages: MessageWithSender[];
  currentUserId: string;
  addableProfiles: Profile[];
}) {
  const router = useRouter();
  const supabase = React.useMemo(() => createClient(), []);
  const { setActiveConversation, markRead } = useMessages();

  const [messages, setMessages] =
    React.useState<MessageWithSender[]>(initialMessages);
  const [content, setContent] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const bottomRef = React.useRef<HTMLDivElement>(null);
  const initialScrollRef = React.useRef(true);
  const lastMsgIdRef = React.useRef<string | null>(null);

  const others = participants.filter((p) => p.id !== currentUserId);
  const display = conversationDisplay(conversation, others, participants);

  const profileById = React.useMemo(() => {
    const m = new Map<string, Profile>();
    for (const p of participants) m.set(p.id, p);
    return m;
  }, [participants]);

  // Index of the viewer's most recent own message — the only place a status
  // label is shown (keeps the thread uncluttered).
  const lastOwnIndex = React.useMemo(() => {
    let idx = -1;
    for (let i = 0; i < messages.length; i++) {
      if (messages[i].sender_id === currentUserId) idx = i;
    }
    return idx;
  }, [messages, currentUserId]);

  React.useEffect(() => {
    setActiveConversation(conversation.id);
    markRead(conversation.id);
    // Opening the conversation delivers any messages that arrived earlier.
    void markConversationDelivered(conversation.id);
    return () => setActiveConversation(null);
  }, [conversation.id, setActiveConversation, markRead]);

  React.useEffect(() => {
    const channel = supabase
      .channel(`thread-${conversation.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversation.id}`,
        },
        async (payload) => {
          const row = payload.new as Message;
          let sender = profileById.get(row.sender_id);
          if (!sender) {
            const { data } = await supabase
              .from("profiles")
              .select("*")
              .eq("id", row.sender_id)
              .single();
            sender = (data as Profile) ?? undefined;
          }
          if (!sender) return;
          setMessages((prev) =>
            prev.some((m) => m.id === row.id)
              ? prev
              : [...prev, { ...row, sender: sender as Profile }]
          );
          // The provider already persists last_read_at for the active
          // conversation on incoming messages — no need to double-write here.
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversation.id}`,
        },
        (payload) => {
          const row = payload.new as Message;
          setMessages((prev) =>
            prev.map((m) => (m.id === row.id ? { ...m, status: row.status } : m))
          );
        }
      )
      .subscribe((status) => {
        if (status !== "SUBSCRIBED") return;
        // Reconcile on (re)subscribe to backfill anything missed during a
        // socket gap (postgres_changes is forward-only, no replay).
        void (async () => {
          const fresh = await getMessages(supabase, conversation.id);
          setMessages((prev) => {
            const byId = new Map(prev.map((m) => [m.id, m]));
            // Fresh server rows win for known ids (canonical status + created_at
            // + sender); prev-only optimistic rows are retained.
            for (const m of fresh) byId.set(m.id, m);
            return Array.from(byId.values()).sort((a, b) => {
              const c = a.created_at.localeCompare(b.created_at);
              return c !== 0 ? c : a.id.localeCompare(b.id);
            });
          });
        })();
      });
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, conversation.id, profileById]);

  // Auto-scroll to newest — but don't yank a user who has scrolled up to read
  // history. Always scroll on first mount and after the viewer's own send.
  React.useEffect(() => {
    const last = messages[messages.length - 1];
    const appended = !!last && last.id !== lastMsgIdRef.current;
    lastMsgIdRef.current = last?.id ?? null;
    // Ignore in-place changes (e.g. a sent→delivered status flip) so a
    // scrolled-up reader isn't yanked to the bottom.
    if (!initialScrollRef.current && !appended) return;

    const mine = !!last && last.sender_id === currentUserId;
    const nearBottom =
      window.innerHeight + window.scrollY >=
      document.documentElement.scrollHeight - 250;
    if (initialScrollRef.current || mine || nearBottom) {
      bottomRef.current?.scrollIntoView({
        behavior: initialScrollRef.current ? "auto" : "smooth",
        block: "end",
      });
      initialScrollRef.current = false;
    }
  }, [messages, currentUserId]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = content.trim();
    if (!text || sending) return;
    setSending(true);

    const res = await sendMessage({ conversationId: conversation.id, content: text });
    if (res.error) {
      toast.error(res.error);
      setSending(false);
      return;
    }
    setContent("");
    setSending(false);

    if (res.messageId) {
      const me = profileById.get(currentUserId);
      setMessages((prev) =>
        prev.some((m) => m.id === res.messageId)
          ? prev
          : [
              ...prev,
              {
                id: res.messageId!,
                conversation_id: conversation.id,
                sender_id: currentUserId,
                content: text,
                status: "sent",
                created_at: new Date().toISOString(),
                sender:
                  me ??
                  ({
                    id: currentUserId,
                    username: "you",
                    display_name: null,
                    bio: null,
                    avatar_url: null,
                    created_at: "",
                    updated_at: "",
                  } as Profile),
              },
            ]
      );
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="sticky top-14 z-20 flex items-center gap-3 border-b border-border bg-background/80 px-4 py-2.5 backdrop-blur lg:top-0">
        <Link
          href="/messages"
          className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Back to inbox"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <ConversationAvatar
          avatars={display.avatars}
          isGroup={display.isGroup}
          className="h-9 w-9"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold leading-tight">{display.title}</p>
          <p className="truncate text-xs text-muted-foreground">
            {display.handle ? `@${display.handle}` : `${participants.length} members`}
          </p>
        </div>
        {conversation.is_group && (
          <AddPeople
            conversationId={conversation.id}
            addable={addableProfiles}
            onAdded={() => router.refresh()}
          />
        )}
      </div>

      {/* Messages */}
      <div className="min-h-[calc(100dvh-16rem)] px-4 py-4">
        {messages.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No messages yet. Say hi 👋
          </p>
        ) : (
          messages.map((m, i) => {
            const mine = m.sender_id === currentUserId;
            const showName =
              conversation.is_group &&
              !mine &&
              (i === 0 || messages[i - 1].sender_id !== m.sender_id);
            return (
              <div
                key={m.id}
                className={cn("flex items-end gap-2 py-0.5", mine && "flex-row-reverse")}
              >
                {!mine ? (
                  <UserAvatar profile={m.sender} className="h-7 w-7 shrink-0" />
                ) : (
                  <span className="w-7 shrink-0" />
                )}
                <div className="max-w-[78%]">
                  {showName && (
                    <p className="mb-0.5 px-1 text-xs text-muted-foreground">
                      {m.sender.display_name || m.sender.username}
                    </p>
                  )}
                  <div
                    className={cn(
                      "whitespace-pre-wrap break-anywhere rounded-2xl px-3.5 py-2 text-[15px] leading-snug",
                      mine
                        ? "rounded-br-md bg-primary text-primary-foreground"
                        : "rounded-bl-md bg-muted text-foreground"
                    )}
                  >
                    {m.content}
                  </div>
                  {mine ? (
                    i === lastOwnIndex ? (
                      <p className="mt-0.5 px-1 text-right text-[11px] text-muted-foreground">
                        {m.status === "delivered" ? "Delivered" : "Sent"}
                      </p>
                    ) : null
                  ) : (
                    <p className="mt-0.5 px-1 text-[11px] text-muted-foreground">
                      {formatRelativeTime(m.created_at)}
                    </p>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <form
        onSubmit={onSubmit}
        className="sticky bottom-16 z-20 flex items-center gap-2 border-t border-border bg-background/95 p-3 backdrop-blur lg:bottom-0"
      >
        <Input
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Start a message"
          aria-label="Message"
          className="rounded-full bg-muted focus-visible:bg-background"
          maxLength={2000}
          autoFocus
        />
        <Button
          type="submit"
          size="icon"
          className="shrink-0"
          disabled={!content.trim() || sending}
          aria-label="Send message"
        >
          {sending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <SendHorizontal className="h-4 w-4" />
          )}
        </Button>
      </form>
    </div>
  );
}

function AddPeople({
  conversationId,
  addable,
  onAdded,
}: {
  conversationId: string;
  addable: Profile[];
  onAdded: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [saving, setSaving] = React.useState(false);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function onAdd() {
    if (selected.size === 0 || saving) return;
    setSaving(true);
    const res = await addParticipants({
      conversationId,
      targetIds: Array.from(selected),
    });
    setSaving(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success("Added to the conversation.");
    setSelected(new Set());
    setOpen(false);
    onAdded();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Add people">
          <UserPlus className="h-5 w-5" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add people</DialogTitle>
        </DialogHeader>
        {addable.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">
            Everyone you follow is already in this conversation.
          </p>
        ) : (
          <div className="max-h-72 overflow-y-auto">
            {addable.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => toggle(p.id)}
                className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-muted"
              >
                <UserAvatar profile={p} className="h-9 w-9" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">
                    {p.display_name || p.username}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    @{p.username}
                  </p>
                </div>
                <span
                  className={cn(
                    "flex h-5 w-5 items-center justify-center rounded-full border text-xs",
                    selected.has(p.id)
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input"
                  )}
                  aria-hidden
                >
                  {selected.has(p.id) ? "✓" : ""}
                </span>
              </button>
            ))}
          </div>
        )}
        <Button onClick={onAdd} disabled={selected.size === 0 || saving}>
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Add{selected.size > 0 ? ` (${selected.size})` : ""}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
