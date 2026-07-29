"use client";

import * as React from "react";
import { Loader2, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

type Gif = {
  id: string;
  url: string;
  preview: string;
  title: string;
};

export function GifPickerButton({
  onSelect,
  disabled,
}: {
  onSelect: (url: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [gifs, setGifs] = React.useState<Gif[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    setError(null);
    const t = setTimeout(
      async () => {
        try {
          const res = await fetch(`/api/gifs?q=${encodeURIComponent(query)}`);
          const json = await res.json();
          if (!active) return;
          if (!res.ok) {
            setError(json.error || "GIF search failed.");
            setGifs([]);
          } else {
            setGifs(json.gifs ?? []);
          }
        } catch {
          if (active) setError("Couldn't load GIFs.");
        } finally {
          if (active) setLoading(false);
        }
      },
      query ? 350 : 0
    );
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [open, query]);

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setQuery("");
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9 text-primary"
          aria-label="Add GIF"
          disabled={disabled}
        >
          <span className="text-[11px] font-bold tracking-tight">GIF</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-2" align="start" sideOffset={8}>
        <div className="relative mb-2">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search GIPHY"
            className="pl-8"
            autoFocus
          />
        </div>
        <div className="h-72 overflow-y-auto">
          {loading ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">
              {error}
            </p>
          ) : gifs.length === 0 ? (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">
              No GIFs found.
            </p>
          ) : (
            <div className="columns-2 gap-2">
              {gifs.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => {
                    onSelect(g.url);
                    setOpen(false);
                  }}
                  className="mb-2 block w-full overflow-hidden rounded-md border border-border transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-ring"
                  aria-label={`Send ${g.title}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={g.preview} alt={g.title} className="w-full" loading="lazy" />
                </button>
              ))}
            </div>
          )}
        </div>
        <p className="pt-1 text-center text-[10px] text-muted-foreground">
          Powered by GIPHY
        </p>
      </PopoverContent>
    </Popover>
  );
}
