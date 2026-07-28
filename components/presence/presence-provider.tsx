"use client";

import * as React from "react";

import { createClient } from "@/lib/supabase/client";

type PresenceContextValue = {
  /** True if the given user is tracked in the live Presence channel. */
  isOnline: (userId: string) => boolean;
};

const PresenceContext = React.createContext<PresenceContextValue>({
  isOnline: () => false,
});

export function usePresence() {
  return React.useContext(PresenceContext);
}

// How often to refresh last_seen_at while the tab is visible.
const HEARTBEAT_MS = 45_000;

/**
 * Tracks presence two ways:
 *  - "Active now": a shared Supabase Realtime Presence channel. The tab tracks
 *    itself while visible and untracks when hidden, so presence reflects who is
 *    genuinely looking at the app right now.
 *  - "Away": a heartbeat that writes profiles.last_seen_at on load, on focus,
 *    and on an interval while visible — the fallback the display falls back to
 *    once a user drops out of the Presence channel.
 */
export function PresenceProvider({
  userId,
  children,
}: {
  userId: string | null;
  children: React.ReactNode;
}) {
  const supabase = React.useMemo(() => createClient(), []);
  const [online, setOnline] = React.useState<Set<string>>(new Set());

  React.useEffect(() => {
    if (!userId) return;

    const beat = () => {
      // The PostgREST builder is a lazy thenable — it only issues the request
      // when awaited/then-ed, so this must not be a bare `void expr`.
      void (async () => {
        await supabase
          .from("profiles")
          .update({ last_seen_at: new Date().toISOString() })
          .eq("id", userId);
      })();
    };

    const channel = supabase.channel("online-users", {
      config: { presence: { key: userId } },
    });

    const syncOnline = () => {
      const state = channel.presenceState<{ user_id: string }>();
      const ids = new Set<string>();
      for (const key of Object.keys(state)) {
        for (const meta of state[key]) {
          if (meta.user_id) ids.add(meta.user_id);
        }
      }
      setOnline(ids);
    };

    channel
      .on("presence", { event: "sync" }, syncOnline)
      .on("presence", { event: "join" }, syncOnline)
      .on("presence", { event: "leave" }, syncOnline)
      .subscribe((status) => {
        if (status !== "SUBSCRIBED") return;
        if (document.visibilityState === "visible") {
          void channel.track({ user_id: userId });
          beat();
        }
      });

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void channel.track({ user_id: userId });
        beat();
      } else {
        void channel.untrack();
      }
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", beat);
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") beat();
    }, HEARTBEAT_MS);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", beat);
      void supabase.removeChannel(channel);
    };
  }, [supabase, userId]);

  const value = React.useMemo<PresenceContextValue>(
    () => ({ isOnline: (id: string) => online.has(id) }),
    [online]
  );

  return (
    <PresenceContext.Provider value={value}>
      {children}
    </PresenceContext.Provider>
  );
}
