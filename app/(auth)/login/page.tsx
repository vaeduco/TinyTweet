import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AuthForm } from "@/components/auth-form";
import { CozyBird } from "@/components/cozy-bird";

export const metadata = { title: "Log in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/");

  const { error } = await searchParams;

  return (
    <div className="space-y-6">
      <div className="text-center">
        <CozyBird className="mx-auto" />
        <h1 className="mt-4 text-2xl font-bold tracking-tight text-foreground">
          Welcome back
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Settle in, we saved your spot
        </p>
      </div>

      <AuthForm mode="login" initialError={error} />

      <p className="text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{" "}
        <Link
          href="/signup"
          className="font-semibold text-[#b45309] hover:underline dark:text-[#f59e0b]"
        >
          Sign up
        </Link>
      </p>
    </div>
  );
}
