import { FeedSkeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <div>
      <div className="border-b border-border px-4 py-3">
        <div className="h-6 w-24 animate-pulse rounded bg-muted" />
      </div>
      <FeedSkeleton />
    </div>
  );
}
