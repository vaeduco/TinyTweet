"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { votePoll } from "@/app/actions/polls";
import type { PollOption, PollWithMeta } from "@/lib/types";

function formatTimeLeft(msLeft: number): string {
  if (msLeft <= 0) return "Final results";
  const mins = Math.floor(msLeft / 60000);
  if (mins < 60) return `${mins}m left`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h left`;
  const days = Math.floor(hours / 24);
  return `${days}d left`;
}

export function PollCard({
  poll,
  currentUserId,
}: {
  poll: PollWithMeta;
  currentUserId: string | null;
}) {
  const endsAtMs = React.useMemo(
    () => new Date(poll.ends_at).getTime(),
    [poll.ends_at]
  );

  const [options, setOptions] = React.useState<PollOption[]>(poll.options);
  const [myVote, setMyVote] = React.useState<string | null>(
    poll.my_vote_option_id
  );
  const [voting, setVoting] = React.useState(false);

  // `now` stays null through the first (server-matching) render, then the
  // effect fills it in — so time-dependent output never mismatches on hydration.
  const [now, setNow] = React.useState<number | null>(null);
  React.useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const closed = now !== null && now >= endsAtMs;
  const hasVoted = myVote !== null;
  const showResults = hasVoted || closed;
  const total = options.reduce((sum, o) => sum + o.vote_count, 0);

  async function onVote(optionId: string) {
    if (!currentUserId) {
      toast.error("Sign in to vote.");
      return;
    }
    if (voting || hasVoted || closed) return;
    setVoting(true);

    const prevOptions = options;
    // Optimistic: record the vote and bump the chosen option's tally.
    setMyVote(optionId);
    setOptions((prev) =>
      prev.map((o) =>
        o.id === optionId ? { ...o, vote_count: o.vote_count + 1 } : o
      )
    );

    const res = await votePoll(poll.id, optionId);
    if (res.error) {
      setMyVote(null);
      setOptions(prevOptions);
      toast.error(res.error);
    } else if (res.options) {
      // Reconcile with authoritative counts.
      const counts = new Map(res.options.map((o) => [o.id, o.vote_count]));
      setOptions((prev) =>
        prev.map((o) => ({ ...o, vote_count: counts.get(o.id) ?? o.vote_count }))
      );
    }
    setVoting(false);
  }

  return (
    <div className="mt-2 flex flex-col gap-2">
      {options.map((o) => {
        if (!showResults) {
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => onVote(o.id)}
              // Stay disabled until `now` resolves, so a closed poll never emits
              // an enabled (doomed) vote button during the pre-hydration render.
              disabled={voting || now === null}
              className="w-full rounded-full border border-primary/60 px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/10 disabled:opacity-60"
            >
              {o.text}
            </button>
          );
        }

        const pct = total > 0 ? Math.round((o.vote_count / total) * 100) : 0;
        const isMine = o.id === myVote;
        return (
          <div
            key={o.id}
            className="relative h-9 overflow-hidden rounded-md border border-border"
          >
            <div
              className={cn(
                "absolute inset-y-0 left-0 transition-all",
                isMine ? "bg-primary/30" : "bg-muted-foreground/15"
              )}
              style={{ width: `${pct}%` }}
            />
            <div className="relative flex h-full items-center justify-between gap-2 px-3 text-sm">
              <span
                className={cn(
                  "flex min-w-0 items-center gap-1 truncate",
                  isMine && "font-semibold"
                )}
              >
                <span className="truncate">{o.text}</span>
                {isMine && (
                  <>
                    <Check
                      aria-hidden
                      className="h-3.5 w-3.5 shrink-0 text-primary"
                    />
                    <span className="sr-only">(your vote)</span>
                  </>
                )}
              </span>
              <span className="shrink-0 tabular-nums text-muted-foreground">
                {pct}%
              </span>
            </div>
          </div>
        );
      })}

      <div className="text-sm text-muted-foreground">
        {total} {total === 1 ? "vote" : "votes"}
        {now !== null && (
          <> · {closed ? "Final results" : formatTimeLeft(endsAtMs - now)}</>
        )}
      </div>
    </div>
  );
}
