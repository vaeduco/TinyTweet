"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { SectionCard } from "@/components/settings/ui";
import {
  updateAccount,
  changeEmail,
  changePassword,
  deleteAccount,
} from "@/app/actions/settings";
import type { Profile } from "@/lib/types";

export function AccountSection({
  profile,
  email,
}: {
  profile: Profile;
  email: string;
}) {
  const [username, setUsername] = React.useState(profile.username);
  const [displayName, setDisplayName] = React.useState(
    profile.display_name ?? ""
  );
  const [savingProfile, setSavingProfile] = React.useState(false);

  const [newEmail, setNewEmail] = React.useState("");
  const [savingEmail, setSavingEmail] = React.useState(false);

  const [currentPw, setCurrentPw] = React.useState("");
  const [newPw, setNewPw] = React.useState("");
  const [confirmPw, setConfirmPw] = React.useState("");
  const [savingPw, setSavingPw] = React.useState(false);

  const [deleting, setDeleting] = React.useState(false);
  const [deleteText, setDeleteText] = React.useState("");

  const profileDirty =
    username.trim() !== profile.username ||
    displayName.trim() !== (profile.display_name ?? "");

  async function onSaveProfile() {
    if (savingProfile) return;
    setSavingProfile(true);
    const res = await updateAccount({ username, display_name: displayName });
    if (res.error) toast.error(res.error);
    else toast.success("Profile updated.");
    setSavingProfile(false);
  }

  async function onSaveEmail() {
    if (savingEmail) return;
    setSavingEmail(true);
    const res = await changeEmail(newEmail);
    if (res.error) {
      toast.error(res.error);
    } else {
      toast.success("Check your inbox to confirm the new email address.");
      setNewEmail("");
    }
    setSavingEmail(false);
  }

  async function onSavePassword() {
    if (savingPw) return;
    if (newPw !== confirmPw) {
      toast.error("New passwords don't match.");
      return;
    }
    setSavingPw(true);
    const res = await changePassword(currentPw, newPw);
    if (res.error) {
      toast.error(res.error);
    } else {
      toast.success("Password changed.");
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
    }
    setSavingPw(false);
  }

  async function onDelete() {
    setDeleting(true);
    const res = await deleteAccount();
    if (res.error) {
      toast.error(res.error);
      setDeleting(false);
      return;
    }
    // Force a full reload to clear all client state after deletion.
    window.location.href = "/";
  }

  return (
    <SectionCard title="Account">
      {/* Username + display name */}
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="set-username">Username</Label>
          <Input
            id="set-username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoCapitalize="none"
            spellCheck={false}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="set-display">Display name</Label>
          <Input
            id="set-display"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={50}
            placeholder="Your name"
          />
        </div>
        <Button
          size="sm"
          onClick={onSaveProfile}
          disabled={savingProfile || !profileDirty}
        >
          {savingProfile && <Loader2 className="h-4 w-4 animate-spin" />}
          Save
        </Button>
      </div>

      <hr className="border-border" />

      {/* Email */}
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="set-email">Email</Label>
          <p className="text-xs text-muted-foreground">
            Current: <span className="font-medium">{email}</span>
          </p>
          <Input
            id="set-email"
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="new@email.com"
            autoCapitalize="none"
          />
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={onSaveEmail}
          disabled={savingEmail || newEmail.trim().length === 0}
        >
          {savingEmail && <Loader2 className="h-4 w-4 animate-spin" />}
          Update email
        </Button>
      </div>

      <hr className="border-border" />

      {/* Password */}
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="set-cur-pw">Current password</Label>
          <Input
            id="set-cur-pw"
            type="password"
            value={currentPw}
            onChange={(e) => setCurrentPw(e.target.value)}
            autoComplete="current-password"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="set-new-pw">New password</Label>
          <Input
            id="set-new-pw"
            type="password"
            value={newPw}
            onChange={(e) => setNewPw(e.target.value)}
            autoComplete="new-password"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="set-confirm-pw">Confirm new password</Label>
          <Input
            id="set-confirm-pw"
            type="password"
            value={confirmPw}
            onChange={(e) => setConfirmPw(e.target.value)}
            autoComplete="new-password"
          />
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={onSavePassword}
          disabled={savingPw || !currentPw || !newPw || !confirmPw}
        >
          {savingPw && <Loader2 className="h-4 w-4 animate-spin" />}
          Change password
        </Button>
      </div>

      <hr className="border-border" />

      {/* Delete account */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-destructive">Delete account</p>
        <p className="text-xs text-muted-foreground">
          Permanently removes your account, posts, and all data. This can&apos;t
          be undone.
        </p>
        <Dialog
          onOpenChange={(o) => {
            if (!o) setDeleteText("");
          }}
        >
          <DialogTrigger asChild>
            <Button size="sm" variant="destructive">
              Delete account
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete your account?</DialogTitle>
              <DialogDescription>
                This permanently deletes @{profile.username} and everything in
                it — posts, replies, likes, messages. This action is
                irreversible. Type <b>DELETE</b> to confirm.
              </DialogDescription>
            </DialogHeader>
            <Input
              value={deleteText}
              onChange={(e) => setDeleteText(e.target.value)}
              placeholder="DELETE"
              aria-label="Type DELETE to confirm"
            />
            <DialogFooter>
              <Button
                variant="destructive"
                onClick={onDelete}
                disabled={deleting || deleteText !== "DELETE"}
              >
                {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
                Permanently delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </SectionCard>
  );
}
