"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { UserAvatar } from "@/components/user-avatar";
import { Button } from "@/components/ui/button";
import {
  SectionCard,
  SettingRow,
  SegmentedControl,
  Switch,
} from "@/components/settings/ui";
import { setPrivate, setDmPrivacy, unblockUser } from "@/app/actions/settings";
import type { DmPrivacy, Profile } from "@/lib/types";

export function PrivacySection({
  profile,
  blocked: initialBlocked,
  requestCount,
}: {
  profile: Profile;
  blocked: Profile[];
  requestCount: number;
}) {
  const router = useRouter();
  const [priv, setPriv] = React.useState(profile.is_private ?? false);
  const [dm, setDm] = React.useState<DmPrivacy>(profile.dm_privacy);
  const [blocked, setBlocked] = React.useState<Profile[]>(initialBlocked);

  async function onPrivateChange(next: boolean) {
    const prev = priv;
    setPriv(next); // optimistic
    const res = await setPrivate(next);
    if (res.error) {
      setPriv(prev);
      toast.error(res.error);
    } else {
      router.refresh(); // reflect auto-accepted requests when going public
    }
  }

  async function onDmChange(next: DmPrivacy) {
    const prev = dm;
    setDm(next); // optimistic
    const res = await setDmPrivacy(next);
    if (res.error) {
      setDm(prev);
      toast.error(res.error);
    }
  }

  async function onUnblock(target: Profile) {
    setBlocked((b) => b.filter((p) => p.id !== target.id)); // optimistic
    const res = await unblockUser(target.id);
    if (res.error) {
      // Re-insert only the failed item, so concurrent unblocks aren't clobbered.
      setBlocked((b) =>
        b.some((p) => p.id === target.id) ? b : [target, ...b]
      );
      toast.error(res.error);
    } else {
      toast.success(`Unblocked @${target.username}.`);
    }
  }

  return (
    <SectionCard title="Privacy">
      <SettingRow
        label="Private account"
        hint="Only approved followers can see your posts"
      >
        <Switch
          checked={priv}
          onChange={onPrivateChange}
          label="Private account"
        />
      </SettingRow>

      {(requestCount > 0 || priv) && (
        <Link
          href="/follow-requests"
          className="flex items-center justify-between rounded-lg bg-surface-2/50 px-3 py-2 text-sm font-medium transition-colors hover:bg-surface-2"
        >
          <span>Follow requests</span>
          <span className="text-muted-foreground">
            {requestCount > 0 ? requestCount : "View"}
          </span>
        </Link>
      )}

      <SettingRow label="Who can message you">
        <SegmentedControl<DmPrivacy>
          value={dm}
          onChange={onDmChange}
          options={[
            { value: "everyone", label: "Everyone" },
            { value: "following", label: "Following" },
            { value: "none", label: "No one" },
          ]}
        />
      </SettingRow>

      <div>
        <p className="text-sm font-medium">Blocked accounts</p>
        {blocked.length === 0 ? (
          <p className="mt-1 text-xs text-muted-foreground">
            You haven&apos;t blocked anyone. Blocked people can&apos;t view your
            profile, follow, or message you.
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {blocked.map((p) => (
              <li key={p.id} className="flex items-center gap-3">
                <Link href={`/${p.username}`} className="shrink-0">
                  <UserAvatar profile={p} className="h-9 w-9" />
                </Link>
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/${p.username}`}
                    className="block truncate text-sm font-semibold hover:underline"
                  >
                    {p.display_name || p.username}
                  </Link>
                  <p className="truncate text-xs text-muted-foreground">
                    @{p.username}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onUnblock(p)}
                >
                  Unblock
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </SectionCard>
  );
}
