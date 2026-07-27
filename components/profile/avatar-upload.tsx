"use client";

import * as React from "react";
import { Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { UserAvatar } from "@/components/user-avatar";
import { AVATARS_BUCKET } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";

export function AvatarUpload({
  userId,
  value,
  onChange,
  displayName,
  username,
}: {
  userId: string;
  value: string | null;
  onChange: (url: string | null) => void;
  displayName?: string | null;
  username: string;
}) {
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

    setUploading(true);
    const ext = picked.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${userId}/avatar-${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from(AVATARS_BUCKET)
      .upload(path, picked, { upsert: true });

    if (error) {
      toast.error(`Avatar upload failed: ${error.message}`);
      setUploading(false);
      return;
    }

    const { data } = supabase.storage.from(AVATARS_BUCKET).getPublicUrl(path);
    onChange(data.publicUrl);
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onPickFile}
      />
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        className="group relative block h-20 w-20 rounded-full"
        aria-label="Change avatar"
      >
        <UserAvatar
          profile={{ username, display_name: displayName, avatar_url: value }}
          className="h-20 w-20 border-4 border-background"
        />
        <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 text-white opacity-0 transition-opacity group-hover:opacity-100">
          {uploading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Camera className="h-5 w-5" />
          )}
        </span>
      </button>
    </div>
  );
}
