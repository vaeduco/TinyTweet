"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { UserAvatar } from "@/components/user-avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { MAX_POST_LENGTH, POST_IMAGES_BUCKET } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";
import { createPost } from "@/app/actions/posts";
import type { PostWithAuthor, Profile } from "@/lib/types";

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

  const [content, setContent] = React.useState("");
  const [file, setFile] = React.useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const remaining = MAX_POST_LENGTH - content.length;
  const overLimit = remaining < 0;
  const canSubmit = content.trim().length > 0 && !overLimit && !submitting;

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
    setFile(picked);
    setPreviewUrl(URL.createObjectURL(picked));
  }

  function clearImage() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function uploadImage(pickedFile: File): Promise<string | null> {
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
    return data.publicUrl;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);

    let imageUrl: string | null = null;
    if (file) {
      imageUrl = await uploadImage(file);
      if (!imageUrl) {
        setSubmitting(false);
        return;
      }
    }

    const text = content.trim();
    const res = await createPost({ content: text, imageUrl });

    if (res.error) {
      toast.error(res.error);
      setSubmitting(false);
      return;
    }

    // Reset form
    setContent("");
    clearImage();
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
      };
      onPosted(optimistic);
    } else {
      router.refresh();
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex gap-3 border-b border-border px-4 py-3"
    >
      <UserAvatar profile={profile} className="h-10 w-10 shrink-0" />

      <div className="min-w-0 flex-1">
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          rows={2}
          className="min-h-[52px] resize-none border-0 bg-transparent px-0 py-2 text-lg shadow-none focus-visible:ring-0"
        />

        {previewUrl && (
          <div className="relative mt-2 w-fit">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt="Selected attachment preview"
              className="max-h-80 rounded-2xl border border-border object-cover"
            />
            <button
              type="button"
              onClick={clearImage}
              className="absolute left-2 top-2 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
              aria-label="Remove image"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <div className="mt-2 flex items-center justify-between">
          <div className="flex items-center gap-1">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onPickFile}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-primary"
              onClick={() => fileInputRef.current?.click()}
              aria-label="Add image"
            >
              <ImagePlus className="h-5 w-5" />
            </Button>
          </div>

          <div className="flex items-center gap-3">
            {content.length > 0 && (
              <span
                className={cn(
                  "text-sm tabular-nums",
                  overLimit
                    ? "font-semibold text-destructive"
                    : remaining <= 20
                    ? "text-amber-700 dark:text-amber-500"
                    : "text-muted-foreground"
                )}
              >
                {remaining}
              </span>
            )}
            <Button type="submit" disabled={!canSubmit} className="px-5">
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Post
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}
