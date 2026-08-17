"use client";

import * as React from "react";
import { toast } from "sonner";

import { SectionCard, SettingRow, Switch } from "@/components/settings/ui";
import { setNotificationPrefs } from "@/app/actions/settings";
import { setSoundEnabled } from "@/lib/sound";
import {
  currentPushState,
  subscribeToPush,
  unsubscribeFromPush,
  type PushState,
} from "@/lib/push";
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

type PrefKey = (typeof TYPES)[number]["key"] | "notify_sound";

const PUSH_HINT: Record<PushState, string> = {
  unsupported: "Not supported in this browser",
  unconfigured: "Not set up on the server yet",
  denied: "Blocked — enable notifications in your browser settings",
  default: "Get notified even when TinyTweet isn't open",
  granted: "Get notified even when TinyTweet isn't open",
  subscribed: "On for this device",
};

export function NotificationSection({ profile }: { profile: Profile }) {
  const [prefs, setPrefs] = React.useState<Record<PrefKey, boolean>>({
    notify_follows: profile.notify_follows ?? true,
    notify_likes: profile.notify_likes ?? true,
    notify_replies: profile.notify_replies ?? true,
    notify_mentions: profile.notify_mentions ?? true,
    notify_sound: profile.notify_sound ?? true,
  });

  const [pushState, setPushState] = React.useState<PushState | null>(null);
  const [pushBusy, setPushBusy] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    void currentPushState().then((s) => {
      if (active) setPushState(s);
    });
    return () => {
      active = false;
    };
  }, []);

  async function toggle(key: PrefKey, value: boolean) {
    setPrefs((p) => ({ ...p, [key]: value })); // optimistic
    if (key === "notify_sound") setSoundEnabled(value); // keep the ping in sync
    const res = await setNotificationPrefs({ [key]: value });
    if (res.error) {
      setPrefs((p) => ({ ...p, [key]: !value }));
      if (key === "notify_sound") setSoundEnabled(!value);
      toast.error(res.error);
    }
  }

  async function togglePush(next: boolean) {
    setPushBusy(true);
    try {
      const res = next ? await subscribeToPush() : await unsubscribeFromPush();
      if (!res.ok && res.error) toast.error(res.error);
      else if (res.ok && next) toast.success("Push notifications are on.");
      setPushState(await currentPushState());
    } finally {
      setPushBusy(false);
    }
  }

  const pushActionable =
    pushState === "default" ||
    pushState === "granted" ||
    pushState === "subscribed";

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

      <SettingRow label="Sound" hint="Play a sound for new activity in-app">
        <Switch
          checked={prefs.notify_sound}
          onChange={(v) => toggle("notify_sound", v)}
          label="Notification sound"
        />
      </SettingRow>

      <SettingRow
        label="Push notifications"
        hint={pushState ? PUSH_HINT[pushState] : "Checking…"}
      >
        <Switch
          checked={pushState === "subscribed"}
          onChange={togglePush}
          disabled={pushBusy || !pushActionable}
          label="Push notifications"
        />
      </SettingRow>
    </SectionCard>
  );
}
