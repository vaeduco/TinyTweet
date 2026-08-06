import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AuthForm } from "@/components/auth-form";
import { CozyBird } from "@/components/cozy-bird";

export const metadata = { title: "Sign up" };

export default async function SignupPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/");

  return (
    <div className="space-y-6">
      <div className="text-center">
        <CozyBird className="mx-auto" />
        <h1 className="mt-4 text-2xl font-bold tracking-tight text-foreground">
          Make yourself at home
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Create your cozy corner of TinyTweet
        </p>
      </div>

      <AuthForm mode="signup" />

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-semibold text-[#b45309] hover:underline dark:text-[#f59e0b]"
        >
          Log in
        </Link>
      </p>
    </div>
  );
}
