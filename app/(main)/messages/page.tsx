import Link from "next/link";
import { redirect } from "next/navigation";
import { PenSquare } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { getInbox } from "@/lib/queries";
import { Inbox } from "@/components/messages/inbox";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";
export const metadata = { title: "Messages" };

export default async function MessagesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const conversations = await getInbox(supabase, user.id);

  return (
    <div>
      <div className="sticky top-14 z-30 flex items-center justify-between border-b border-border bg-background/80 px-4 py-3 backdrop-blur lg:top-0">
        <h1 className="text-xl font-bold">Messages</h1>
        <Button asChild size="sm">
          <Link href="/messages/new">
            <PenSquare className="h-4 w-4" />
            New
          </Link>
        </Button>
      </div>
      <Inbox conversations={conversations} currentUserId={user.id} />
    </div>
  );
}
