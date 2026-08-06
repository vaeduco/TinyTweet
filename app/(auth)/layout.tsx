export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className="flex min-h-dvh items-center justify-center px-4 py-10"
      style={{
        backgroundColor: "var(--surface-0, #faf6ef)",
        backgroundImage:
          "linear-gradient(160deg, #78350f18, #92400e10, var(--surface-0, #faf6ef))",
      }}
    >
      <div className="w-full max-w-[400px] rounded-[24px] border border-[#d9770622] bg-surface-1 p-9 shadow-sm">
        {children}
      </div>
    </div>
  );
}
