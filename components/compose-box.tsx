"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { BarChart2, Image as ImageIcon, Loader2, MapPin, X } from "lucide-react";
import { toast } from "sonner";

import { UserAvatar } from "@/components/user-avatar";
import { Button } from "@/components/ui/button";
import { EmojiPickerButton } from "@/components/media/emoji-picker-button";
import { GifPickerButton } from "@/components/media/gif-picker-button";
import {
  PollComposer,
  DEFAULT_POLL_DRAFT,
  isPollDraftValid,
  type PollDraft,
} from "@/components/poll/poll-composer";
import { cn } from "@/lib/utils";
import { MAX_POST_LENGTH, POST_IMAGES_BUCKET } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";
import { createPost, createPollPost } from "@/app/actions/posts";
import type { PostWithAuthor, Profile } from "@/lib/types";

/** Twitter-style circular character counter: full track + accent arc that
 * fills proportionally, turning amber near the limit and red when over. */
function ProgressRing({ value, max }: { value: number; max: number }) {
  const r = 9;
  const circ = 2 * Math.PI * r;
  const over = value > max;
  const near = !over && max - value <= 20;
  const pct = over ? 1 : Math.min(value / max, 1);
  const stroke = over
    ? "hsl(var(--destructive))"
    : near
    ? "#eab308"
    : "hsl(var(--fill-accent))";

  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      className="-rotate-90"
      aria-hidden
    >
      <circle
        cx="12"
        cy="12"
        r={r}
        fill="none"
        stroke="hsl(var(--border))"
        strokeWidth="2.5"
      />
      <circle
        cx="12"
        cy="12"
        r={r}
        fill="none"
        stroke={stroke}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={circ * (1 - pct)}
      />
    </svg>
  );
}

/** A toolbar icon button styled to match the emoji/GIF pickers. */
function ToolbarButton({
  icon: Icon,
  label,
  onClick,
  disabled,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-9 w-9 text-primary"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
    >
      <Icon className="h-5 w-5" />
    </Button>
  );
}

export function ComposeBox({
  profile,
  onPosted,
  placeholder = "What's happening?",
  autoFocus = false,
}: {
  profile: Profile;
  /** Called with an optimistic post on success (feed prepends it). */
  onPosted?: (post: PostWithAuthor) => void;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const router = useRouter();
  const supabase = React.useMemo(() => createClient(), []);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const [content, setContent] = React.useState("");
  const [file, setFile] = React.useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [gifUrl, setGifUrl] = React.useState<string | null>(null);
  const [poll, setPoll] = React.useState<PollDraft | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  // Auto-grow the textarea to fit its content (min height keeps it comfortable).
  React.useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [content]);

  // Measure the trimmed length so the counter, over-limit state, and Post
  // button all agree with what createPost actually validates (it trims too).
  const count = content.trim().length;
  const overLimit = count > MAX_POST_LENGTH;
  const near = !overLimit && MAX_POST_LENGTH - count <= 20;
  const pollValid = poll === null || isPollDraftValid(poll);
  const canSubmit = count > 0 && !overLimit && !submitting && pollValid;
  const attachment = previewUrl ?? gifUrl;

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0];
    if (!picked) return;
    if (!picked.type.startsWith("image/")) {
      toast.error("Please choose an image file.");
      return;
    }
    if (picked.size > 5 * 1024 * 1024) {
      toast.error("Image must be 5MB or smaller.");
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setGifUrl(null); // photo and GIF are mutually exclusive
    setFile(picked);
    setPreviewUrl(URL.createObjectURL(picked));
  }

  function onSelectGif(url: string) {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setGifUrl(url);
  }

  function clearAttachment() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null);
    setPreviewUrl(null);
    setGifUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function openPoll() {
    clearAttachment(); // a post can carry a poll OR media, never both
    setPoll(DEFAULT_POLL_DRAFT);
  }

  function insertEmoji(emoji: string) {
    const el = textareaRef.current;
    if (!el) {
      setContent((c) => c + emoji);
      return;
    }
    const start = el.selectionStart ?? content.length;
    const end = el.selectionEnd ?? content.length;
    const next = content.slice(0, start) + emoji + content.slice(end);
    setContent(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + emoji.length;
      el.setSelectionRange(pos, pos);
    });
  }

  async function uploadImage(
    pickedFile: File
  ): Promise<{ url: string; path: string } | null> {
    const ext = pickedFile.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${profile.id}/${Date.now()}-${Math.round(
      performance.now()
    )}.${ext}`;
    const { error } = await supabase.storage
      .from(POST_IMAGES_BUCKET)
      .upload(path, pickedFile, { cacheControl: "3600", upsert: false });
    if (error) {
      toast.error(`Image upload failed: ${error.message}`);
      return null;
    }
    const { data } = supabase.storage
      .from(POST_IMAGES_BUCKET)
      .getPublicUrl(path);
    return { url: data.publicUrl, path };
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);

    if (poll) {
      const res = await createPollPost({
        content: content.trim(),
        options: poll.options,
        durationMinutes: poll.durationMinutes,
      });
      if (res.error) {
        toast.error(res.error);
        setSubmitting(false);
        return;
      }
      setContent("");
      setPoll(null);
      setSubmitting(false);
      // Poll posts need their server-generated option ids to be votable, so
      // refresh to pull the real post rather than prepend a synthetic one.
      router.refresh();
      return;
    }

    let imageUrl: string | null = null;
    let uploadedPath: string | null = null;
    if (file) {
      const uploaded = await uploadImage(file);
      if (!uploaded) {
        setSubmitting(false);
        return;
      }
      imageUrl = uploaded.url;
      uploadedPath = uploaded.path;
    } else if (gifUrl) {
      imageUrl = gifUrl;
    }

    const text = content.trim();
    const res = await createPost({ content: text, imageUrl });

    if (res.error) {
      // Don't leave the just-uploaded image orphaned in storage (best-effort).
      if (uploadedPath) {
        await supabase.storage.from(POST_IMAGES_BUCKET).remove([uploadedPath]);
      }
      toast.error(res.error);
      setSubmitting(false);
      return;
    }

    // Reset form
    setContent("");
    clearAttachment();
    setSubmitting(false);

    if (onPosted && res.postId) {
      const optimistic: PostWithAuthor = {
        id: res.postId,
        user_id: profile.id,
        content: text,
        image_url: imageUrl,
        like_count: 0,
        reply_count: 0,
        created_at: new Date().toISOString(),
        author: profile,
        liked_by_me: false,
        saved_by_me: false,
        poll: null,
      };
      onPosted(optimistic);
    } else {
      router.refresh();
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-[18px] bg-surface-1 p-3 shadow-sm transition-shadow focus-within:ring-1 focus-within:ring-primary/30"
    >
      <div className="flex gap-3">
        <UserAvatar profile={profile} className="h-11 w-11 shrink-0" />

        <div className="min-w-0 flex-1">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={placeholder}
            autoFocus={autoFocus}
            rows={1}
            aria-invalid={overLimit || undefined}
            aria-describedby="compose-status"
            className="min-h-[48px] w-full resize-none overflow-hidden border-0 bg-transparent py-2 text-lg leading-relaxed placeholder:text-muted-foreground focus:outline-none"
          />

          {attachment && (
            <div className="relative mt-1 w-fit">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={attachment}
                alt="Selected attachment preview"
                className="h-[90px] w-auto rounded-xl border border-border object-cover"
              />
              <button
                type="button"
                onClick={clearAttachment}
                className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white transition-colors hover:bg-black/80"
                aria-label="Remove attachment"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {poll && (
            <PollComposer
              value={poll}
              onChange={setPoll}
              onRemove={() => setPoll(null)}
              disabled={submitting}
            />
          )}
        </div>
      </div>

      {/* Toolbar — sits below the text/image, separated by a thin top border. */}
      <div className="mt-3 flex items-center gap-0.5 border-t border-border pt-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onPickFile}
        />
        <ToolbarButton
          icon={ImageIcon}
          label="Add image"
          onClick={() => fileInputRef.current?.click()}
          disabled={poll !== null}
        />
        <GifPickerButton onSelect={onSelectGif} disabled={poll !== null} />
        <EmojiPickerButton onEmoji={insertEmoji} />
        <ToolbarButton
          icon={BarChart2}
          label="Create poll"
          onClick={openPoll}
          disabled={poll !== null || attachment !== null}
        />
        <ToolbarButton
          icon={MapPin}
          label="Add location"
          onClick={() => toast("Location tagging is coming soon.")}
        />
      </div>

      {/* Footer — right-aligned counter, progress ring, and Post button. */}
      <div className="mt-2 flex items-center justify-end gap-3">
        {count > 0 && (
          <>
            <span
              className={cn(
                "text-sm tabular-nums",
                overLimit ? "font-semibold text-destructive" : "text-muted-foreground"
              )}
            >
              {count}/{MAX_POST_LENGTH}
            </span>
            <ProgressRing value={count} max={MAX_POST_LENGTH} />
          </>
        )}
        <Button
          type="submit"
          disabled={!canSubmit}
          aria-describedby="compose-status"
          className="rounded-full px-5 font-bold disabled:bg-surface-2 disabled:text-muted-foreground disabled:opacity-100"
        >
          {submitting && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
          Post
        </Button>
      </div>

      {/* Screen-reader status: announces the count near the limit and when
          over (kept silent otherwise so it doesn't read on every keystroke). */}
      <span id="compose-status" role="status" aria-live="polite" className="sr-only">
        {overLimit
          ? `${count - MAX_POST_LENGTH} character${
              count - MAX_POST_LENGTH === 1 ? "" : "s"
            } over the limit. You can't post yet.`
          : near
          ? `${MAX_POST_LENGTH - count} characters remaining.`
          : ""}
      </span>
    </form>
  );
}
