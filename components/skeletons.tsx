import { Skeleton } from "@/components/ui/skeleton";

export function PostSkeleton() {
  return (
    <div className="flex gap-3 rounded-[14px] bg-surface-1 px-3.5 py-2.5 shadow-sm">
      <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
      <div className="flex-1 space-y-2.5 py-1">
        <div className="flex items-center gap-2">
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className="h-3.5 w-16" />
        </div>
        <Skeleton className="h-3.5 w-full" />
        <Skeleton className="h-3.5 w-4/5" />
        <div className="flex gap-10 pt-1.5">
          <Skeleton className="h-3.5 w-8" />
          <Skeleton className="h-3.5 w-8" />
          <Skeleton className="h-3.5 w-8" />
        </div>
      </div>
    </div>
  );
}

export function FeedSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div aria-hidden="true" className="flex flex-col gap-2 p-2">
      {Array.from({ length: count }).map((_, i) => (
        <PostSkeleton key={i} />
      ))}
    </div>
  );
}

export function ProfileHeaderSkeleton() {
  return (
    <div className="border-b border-border">
      <Skeleton className="h-32 w-full rounded-none sm:h-40" />
      <div className="px-4 pb-4">
        <div className="-mt-10 flex items-end justify-between">
          <Skeleton className="h-20 w-20 rounded-full border-4 border-background" />
          <Skeleton className="h-9 w-24 rounded-full" />
        </div>
        <div className="mt-3 space-y-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-64" />
        </div>
      </div>
    </div>
  );
}
