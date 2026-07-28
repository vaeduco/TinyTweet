import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import {
  getConversationForViewer,
  getFollowedProfiles,
  getMessages,
} from "@/lib/queries";
import { ThreadView } from "@/components/messages/thread-view";

export const dynamic = "force-dynamic";

export default async function ThreadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const conv = await getConversationForViewer(supabase, id, user.id);
  if (!conv) notFound();

  const messages = await getMessages(supabase, id);

  // People the viewer follows who aren't already in this conversation (group "add people").
  const participantIds = new Set(conv.participants.map((p) => p.id));
  const followed = await getFollowedProfiles(supabase, user.id);
  const addable = followed.filter((p) => !participantIds.has(p.id));

  return (
    <ThreadView
      conversation={conv.conversation}
      participants={conv.participants}
      initialMessages={messages}
      currentUserId={user.id}
      addableProfiles={addable}
    />
  );
}
