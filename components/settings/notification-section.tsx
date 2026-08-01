"use client";

import * as React from "react";
import { toast } from "sonner";

import { SectionCard, SettingRow, Switch } from "@/components/settings/ui";
import { setNotificationPrefs } from "@/app/actions/settings";
import type { Profile } from "@/lib/types";

const TYPES = [
  { key: "notify_follows", label: "Follows", hint: "When someone follows you" },
  { key: "notify_likes", label: "Likes", hint: "When someone likes your post" },
  {
    key: "notify_replies",
    label: "Replies",
    hint: "When someone replies to your post",
  },
  {
    key: "notify_mentions",
    label: "Mentions",
    hint: "When someone @mentions you",
  },
] as const;

type PrefKey = (typeof TYPES)[number]["key"];

export function NotificationSection({ profile }: { profile: Profile }) {
  const [prefs, setPrefs] = React.useState<Record<PrefKey, boolean>>({
    notify_follows: profile.notify_follows ?? true,
    notify_likes: profile.notify_likes ?? true,
    notify_replies: profile.notify_replies ?? true,
    notify_mentions: profile.notify_mentions ?? true,
  });

  async function toggle(key: PrefKey, value: boolean) {
    setPrefs((p) => ({ ...p, [key]: value })); // optimistic
    const res = await setNotificationPrefs({ [key]: value });
    if (res.error) {
      // Revert only this key, so other in-flight toggles aren't clobbered.
      setPrefs((p) => ({ ...p, [key]: !value }));
      toast.error(res.error);
    }
  }

  return (
    <SectionCard
      title="Notifications"
      description="Choose what you're notified about."
    >
      {TYPES.map((t) => (
        <SettingRow key={t.key} label={t.label} hint={t.hint}>
          <Switch
            checked={prefs[t.key]}
            onChange={(v) => toggle(t.key, v)}
            label={t.label}
          />
        </SettingRow>
      ))}
    </SectionCard>
  );
}
