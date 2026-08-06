import { AuthBackground } from "@/components/auth-background";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className="relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-10"
      style={{ backgroundColor: "#0a0a12" }}
    >
      <AuthBackground />
      <div className="relative z-10 w-full max-w-[400px] rounded-[24px] border border-[#d9770622] bg-surface-1 p-9 shadow-[0_16px_50px_-12px_rgba(0,0,0,0.6)] dark:border-white/10">
        {children}
      </div>
    </div>
  );
}
