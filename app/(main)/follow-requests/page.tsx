import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { getFollowRequests } from "@/lib/queries";
import { FollowRequestRow } from "@/components/profile/follow-request-row";

export const dynamic = "force-dynamic";
export const metadata = { title: "Follow requests" };

export default async function FollowRequestsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const requests = await getFollowRequests(supabase, user.id);

  return (
    <div>
      <div className="sticky top-14 z-30 flex items-center gap-4 border-b border-border bg-background px-4 py-3 lg:top-0">
        <Link
          href="/notifications"
          className="rounded-full p-1 text-foreground transition-colors hover:bg-muted"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-xl font-bold">Follow requests</h1>
      </div>

      {requests.length === 0 ? (
        <div className="px-6 py-16 text-center">
          <p className="text-lg font-bold">No follow requests</p>
          <p className="mx-auto mt-1 max-w-xs text-muted-foreground">
            When someone asks to follow your private account, it'll show up here.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2 p-2">
          {requests.map((p) => (
            <FollowRequestRow key={p.id} profile={p} />
          ))}
        </div>
      )}
    </div>
  );
}
