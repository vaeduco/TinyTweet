"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { AvatarUpload } from "@/components/profile/avatar-upload";
import { cn } from "@/lib/utils";
import { updateProfile } from "@/app/actions/profile";
import type { Profile } from "@/lib/types";

const MAX_DISPLAY_NAME = 50;
const MAX_BIO = 160;

export function EditProfileDialog({ profile }: { profile: Profile }) {
  const router = useRouter();

  const [open, setOpen] = React.useState(false);
  const [displayName, setDisplayName] = React.useState(
    profile.display_name ?? ""
  );
  const [bio, setBio] = React.useState(profile.bio ?? "");
  const [avatarUrl, setAvatarUrl] = React.useState<string | null>(
    profile.avatar_url
  );
  const [saving, setSaving] = React.useState(false);

  const remaining = MAX_BIO - bio.length;

  async function onSave() {
    if (saving) return;
    setSaving(true);

    const res = await updateProfile({
      display_name: displayName,
      bio,
      avatar_url: avatarUrl,
    });

    if (res.error) {
      toast.error(res.error);
      setSaving(false);
      return;
    }

    toast.success("Profile updated.");
    setSaving(false);
    setOpen(false);
    router.refresh();
  }

  function onOpenChange(next: boolean) {
    // Re-seed fields from the live profile on open so a cancelled edit
    // (including an un-saved avatar) is fully discarded.
    if (next) {
      setDisplayName(profile.display_name ?? "");
      setBio(profile.bio ?? "");
      setAvatarUrl(profile.avatar_url);
    }
    setOpen(next);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Edit profile
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit profile</DialogTitle>
          <DialogDescription>
            Update how others see you on TinyTweet.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <AvatarUpload
            userId={profile.id}
            value={avatarUrl}
            onChange={setAvatarUrl}
            displayName={displayName}
            username={profile.username}
          />

          <div className="space-y-1.5">
            <Label htmlFor="displayName">Display name</Label>
            <Input
              id="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={MAX_DISPLAY_NAME}
              placeholder="Your name"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="bio">Bio</Label>
              <span
                className={cn(
                  "text-xs tabular-nums",
                  remaining < 0
                    ? "font-semibold text-destructive"
                    : "text-muted-foreground"
                )}
              >
                {remaining}
              </span>
            </div>
            <Textarea
              id="bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={MAX_BIO}
              rows={3}
              placeholder="Tell people about yourself"
            />
          </div>
        </div>

        <DialogFooter>
          <Button onClick={onSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
