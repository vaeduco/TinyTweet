import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

type AvatarProfile = {
  username: string;
  display_name?: string | null;
  avatar_url?: string | null;
};

export function UserAvatar({
  profile,
  className,
}: {
  profile: AvatarProfile;
  className?: string;
}) {
  const name = profile.display_name || profile.username;
  const initials = name.replace(/[^a-zA-Z0-9]/g, "").slice(0, 2) || name.slice(0, 2);

  return (
    <Avatar className={className}>
      {profile.avatar_url ? (
        <AvatarImage src={profile.avatar_url} alt={name} />
      ) : null}
      <AvatarFallback>{initials}</AvatarFallback>
    </Avatar>
  );
}
