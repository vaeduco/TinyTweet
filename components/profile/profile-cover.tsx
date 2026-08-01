"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { AVATARS_BUCKET } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";
import { updateCover } from "@/app/actions/profile";

/** Extract the storage object key (e.g. "<uid>/cover-123.jpg") from a public
 * avatars URL, so a replaced cover can be cleaned up. */
function coverKey(url: string | null): string | null {
  if (!url) return null;
  const marker = `/${AVATARS_BUCKET}/`;
  const idx = url.indexOf(marker);
  return idx === -1 ? null : url.slice(idx + marker.length).split("?")[0];
}

/** The cover-photo banner at the top of a profile: shows the cover image (or a
 * gradient placeholder), a semi-transparent back button, and — for the owner —
 * a camera button that uploads a new cover. */
export function ProfileCover({
  coverUrl,
  userId,
  isOwner,
}: {
  coverUrl: string | null;
  userId: string;
  isOwner: boolean;
}) {
  const router = useRouter();
  const supabase = React.useMemo(() => createClient(), []);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = React.useState(false);

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
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

    const oldKey = coverKey(coverUrl);
    const ext = picked.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${userId}/cover-${Date.now()}.${ext}`;

    setUploading(true);
    try {
      const { error } = await supabase.storage
        .from(AVATARS_BUCKET)
        .upload(path, picked, { upsert: true });
      if (error) {
        toast.error(`Cover upload failed: ${error.message}`);
        return;
      }

      const { data } = supabase.storage.from(AVATARS_BUCKET).getPublicUrl(path);
      const res = await updateCover(data.publicUrl);
      if (res.error) {
        // Don't leave the just-uploaded file orphaned in storage.
        await supabase.storage.from(AVATARS_BUCKET).remove([path]);
        toast.error(res.error);
        return;
      }

      // The new cover is saved — best-effort remove the previous one.
      if (oldKey && oldKey !== path) {
        await supabase.storage.from(AVATARS_BUCKET).remove([oldKey]);
      }
      router.refresh();
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="relative h-[140px] w-full overflow-hidden">
      {coverUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={coverUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        <div className="h-full w-full bg-gradient-to-br from-primary/40 via-primary/20 to-primary/10" />
      )}

      {/* Back — top-left, legible over any cover image. */}
      <Link
        href="/"
        aria-label="Back to home"
        className="absolute left-3 top-3 rounded-full bg-black/40 p-2 text-white backdrop-blur-sm transition-colors hover:bg-black/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
      >
        <ArrowLeft className="h-5 w-5" />
      </Link>

      {/* Change cover — top-right, owner only. */}
      {isOwner && (
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onPickFile}
          />
          <button
            type="button"
            onClick={() => {
              // Reset first so re-picking the same file after an error still fires.
              if (fileInputRef.current) fileInputRef.current.value = "";
              fileInputRef.current?.click();
            }}
            disabled={uploading}
            aria-label="Change cover photo"
            className="absolute right-3 top-3 rounded-full bg-black/40 p-2 text-white backdrop-blur-sm transition-colors hover:bg-black/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 disabled:opacity-70"
          >
            {uploading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Camera className="h-5 w-5" />
            )}
          </button>
        </>
      )}
    </div>
  );
}
