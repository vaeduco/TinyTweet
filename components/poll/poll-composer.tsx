"use client";

import * as React from "react";
import { Plus, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export type PollDraft = { options: string[]; durationMinutes: number };

export const DEFAULT_POLL_DRAFT: PollDraft = {
  options: ["", ""],
  durationMinutes: 1440,
};

export const MAX_POLL_OPTIONS = 4;
export const MIN_POLL_OPTIONS = 2;
const MAX_OPTION_LEN = 25;

const DURATIONS: { label: string; minutes: number }[] = [
  { label: "1 hour", minutes: 60 },
  { label: "6 hours", minutes: 360 },
  { label: "1 day", minutes: 1440 },
  { label: "3 days", minutes: 4320 },
  { label: "7 days", minutes: 10080 },
];

/** True when the draft is ready to submit: 2–4 options, all non-empty. */
export function isPollDraftValid(draft: PollDraft): boolean {
  const filled = draft.options.map((o) => o.trim()).filter(Boolean);
  return (
    draft.options.every((o) => o.trim().length > 0) &&
    filled.length >= MIN_POLL_OPTIONS &&
    filled.length <= MAX_POLL_OPTIONS
  );
}

export function PollComposer({
  value,
  onChange,
  onRemove,
  disabled,
}: {
  value: PollDraft;
  onChange: (draft: PollDraft) => void;
  onRemove: () => void;
  disabled?: boolean;
}) {
  function setOption(i: number, text: string) {
    const options = value.options.slice();
    options[i] = text;
    onChange({ ...value, options });
  }
  function addOption() {
    if (value.options.length >= MAX_POLL_OPTIONS) return;
    onChange({ ...value, options: [...value.options, ""] });
  }
  function removeOption(i: number) {
    if (value.options.length <= MIN_POLL_OPTIONS) return;
    onChange({
      ...value,
      options: value.options.filter((_, idx) => idx !== i),
    });
  }

  return (
    <div className="mt-2 rounded-2xl border border-border p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-semibold">Poll</span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onRemove}
          disabled={disabled}
          className="h-7 text-muted-foreground hover:text-destructive"
        >
          Remove poll
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        {value.options.map((opt, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              value={opt}
              maxLength={MAX_OPTION_LEN}
              onChange={(e) => setOption(i, e.target.value)}
              placeholder={`Option ${i + 1}`}
              aria-label={`Poll option ${i + 1}`}
              disabled={disabled}
            />
            {value.options.length > MIN_POLL_OPTIONS && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeOption(i)}
                aria-label={`Remove option ${i + 1}`}
                disabled={disabled}
                className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        ))}
      </div>

      {value.options.length < MAX_POLL_OPTIONS && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={addOption}
          disabled={disabled}
          className="mt-2 h-8 text-primary"
        >
          <Plus className="mr-1 h-4 w-4" /> Add option
        </Button>
      )}

      <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
        <label htmlFor="poll-duration" className="text-sm text-muted-foreground">
          Poll length
        </label>
        <select
          id="poll-duration"
          value={value.durationMinutes}
          disabled={disabled}
          onChange={(e) =>
            onChange({ ...value, durationMinutes: Number(e.target.value) })
          }
          className="rounded-md border border-input bg-background px-2 py-1 text-sm"
        >
          {DURATIONS.map((d) => (
            <option key={d.minutes} value={d.minutes}>
              {d.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
