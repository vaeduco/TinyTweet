import { FeedSkeleton, ProfileHeaderSkeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <div>
      <ProfileHeaderSkeleton />
      <FeedSkeleton />
    </div>
  );
}
