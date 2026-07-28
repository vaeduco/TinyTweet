"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Mail } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { createConversation } from "@/app/actions/messages";

export function MessageButton({ targetId }: { targetId: string }) {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);

  async function onClick() {
    if (loading) return;
    setLoading(true);
    const res = await createConversation({ targetIds: [targetId] });
    if (res.error || !res.conversationId) {
      toast.error(res.error ?? "Could not open the conversation.");
      setLoading(false);
      return;
    }
    router.push(`/messages/${res.conversationId}`);
  }

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={onClick}
      disabled={loading}
      aria-label="Message"
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Mail className="h-[18px] w-[18px]" />
      )}
    </Button>
  );
}
