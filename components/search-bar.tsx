"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function SearchBar({
  className,
  defaultValue = "",
  onSubmitted,
}: {
  className?: string;
  defaultValue?: string;
  /** Called after a search is submitted (e.g. to close a containing menu). */
  onSubmitted?: () => void;
}) {
  const router = useRouter();
  const [q, setQ] = React.useState(defaultValue);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const term = q.trim();
    if (term) {
      router.push(`/search?q=${encodeURIComponent(term)}`);
      onSubmitted?.();
    }
  }

  return (
    <form onSubmit={onSubmit} className={cn("w-full", className)} role="search">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search people & posts"
          aria-label="Search"
          className="h-10 rounded-full border-transparent bg-muted pl-9 focus-visible:border-input focus-visible:bg-background"
        />
      </div>
    </form>
  );
}
