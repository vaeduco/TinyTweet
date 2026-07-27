import Link from "next/link";

export default function NotFound() {
  return (
    <div className="px-6 py-16 text-center">
      <p className="text-lg font-bold">This account doesn&apos;t exist</p>
      <p className="mt-1 text-muted-foreground">
        Try searching for another, or head back home.
      </p>
      <Link
        href="/"
        className="mt-4 inline-block font-medium text-primary hover:underline"
      >
        Go home
      </Link>
    </div>
  );
}
