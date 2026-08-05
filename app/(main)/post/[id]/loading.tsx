import { PostSkeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <div>
      <div className="sticky top-14 z-30 flex items-center gap-4 border-b border-border bg-background px-4 py-3">
        <div className="h-5 w-5 animate-pulse rounded bg-muted" />
        <div className="h-6 w-16 animate-pulse rounded bg-muted" />
      </div>
      <div className="flex flex-col gap-2 p-2">
        <PostSkeleton />
        <PostSkeleton />
        <PostSkeleton />
        <PostSkeleton />
      </div>
    </div>
  );
}
