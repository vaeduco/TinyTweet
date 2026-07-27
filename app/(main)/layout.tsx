import { createClient } from "@/lib/supabase/server";
import { Navbar } from "@/components/navbar";
import type { Profile } from "@/lib/types";

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let profile: Profile | null = null;
  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();
    profile = (data as Profile) ?? null;
  }

  return (
    <div className="min-h-screen">
      <Navbar profile={profile} />
      <main className="mx-auto min-h-[calc(100vh-3.5rem)] max-w-2xl border-x border-border pb-16 sm:pb-0">
        {children}
      </main>
    </div>
  );
}
