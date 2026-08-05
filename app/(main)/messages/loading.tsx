import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div>
      <div className="sticky top-14 z-30 flex items-center justify-between border-b border-border bg-background px-4 py-3">
        <div className="h-6 w-28 animate-pulse rounded bg-muted" />
      </div>
      <div className="flex flex-col gap-2 p-2">
        {Array.from({ length: 7 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-[14px] bg-surface-1 px-3.5 py-2.5 shadow-sm"
          >
            <Skeleton className="h-11 w-11 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-48" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
