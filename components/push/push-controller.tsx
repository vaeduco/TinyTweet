"use client";

import * as React from "react";
import { toast } from "sonner";

import {
  registerServiceWorker,
  currentPushState,
  subscribeToPush,
  reassertSubscription,
  pushSupported,
} from "@/lib/push";
import { setSoundEnabled } from "@/lib/sound";

const VISIT_KEY = "tt_visits";
const PROMPTED_KEY = "tt_push_prompted";
const PROMPT_AFTER_VISITS = 3;

/**
 * Mounted once in the app shell for signed-in users. Registers the push service
 * worker, mirrors the sound preference into localStorage, and — only after a
 * few visits, and only once — shows a gentle "turn on notifications?" nudge.
 * The actual browser permission prompt is triggered by the user tapping
 * "Enable" (a gesture), never automatically on load.
 */
export function PushController({ soundEnabled }: { soundEnabled: boolean }) {
  React.useEffect(() => {
    setSoundEnabled(soundEnabled);
    if (!pushSupported()) return;

    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];

    (async () => {
      await registerServiceWorker();
      // On a shared browser, re-bind any existing subscription to this account.
      void reassertSubscription();

      const visits = Number(localStorage.getItem(VISIT_KEY) || "0") + 1;
      localStorage.setItem(VISIT_KEY, String(visits));

      const prompted = localStorage.getItem(PROMPTED_KEY) === "1";
      const state = await currentPushState();
      if (cancelled) return;

      if (!prompted && visits >= PROMPT_AFTER_VISITS && state === "default") {
        localStorage.setItem(PROMPTED_KEY, "1");
        timers.push(
          setTimeout(() => {
            if (cancelled) return;
            toast("Turn on notifications for replies, likes, and messages?", {
              duration: 15000,
              action: {
                label: "Enable",
                onClick: async () => {
                  const res = await subscribeToPush();
                  if (res.ok) toast.success("Push notifications are on.");
                  else if (res.error) toast.error(res.error);
                },
              },
            });
          }, 5000)
        );
      }
    })();

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [soundEnabled]);

  return null;
}
