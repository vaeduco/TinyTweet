import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type GiphyImage = { url?: string; width?: string; height?: string };
type GiphyItem = {
  id: string;
  title?: string;
  images?: Record<string, GiphyImage>;
};

/**
 * Proxies GIPHY search/trending so the API key stays server-side.
 * Configure by adding GIPHY_API_KEY to .env.local (get one at
 * https://developers.giphy.com). Returns 503 until it is set.
 */
export async function GET(request: Request) {
  const noStore = { "Cache-Control": "no-store" };
  // Be forgiving about how the env var was pasted (dashboards often add a
  // trailing newline or wrapping quotes, which GIPHY then rejects as 401).
  const key = process.env.GIPHY_API_KEY?.trim().replace(/^["']+|["']+$/g, "");
  if (!key) {
    return NextResponse.json(
      {
        error:
          "GIF search isn't configured. Add GIPHY_API_KEY to .env.local (from developers.giphy.com) and restart the dev server.",
      },
      { status: 503, headers: noStore }
    );
  }

  const q = (new URL(request.url).searchParams.get("q") || "").trim();
  const base = "https://api.giphy.com/v1/gifs";
  const common = `api_key=${key}&limit=24&rating=pg-13&bundle=fixed_height`;
  const endpoint = q
    ? `${base}/search?${common}&q=${encodeURIComponent(q)}`
    : `${base}/trending?${common}`;

  let json: { data?: GiphyItem[] };
  try {
    const res = await fetch(endpoint, { cache: "no-store" });
    if (!res.ok) {
      return NextResponse.json(
        { error: "GIF search failed. Check your GIPHY_API_KEY." },
        { status: 502 }
      );
    }
    json = await res.json();
  } catch {
    return NextResponse.json(
      { error: "Couldn't reach the GIF service." },
      { status: 502 }
    );
  }

  const gifs = (json.data ?? [])
    .map((g) => {
      const full = g.images?.fixed_height;
      const preview = g.images?.fixed_height_small ?? full;
      return {
        id: g.id,
        title: g.title || "GIF",
        url: full?.url,
        preview: preview?.url ?? full?.url,
        width: full?.width ? Number(full.width) : undefined,
        height: full?.height ? Number(full.height) : undefined,
      };
    })
    .filter((g): g is typeof g & { url: string } => Boolean(g.url));

  return NextResponse.json({ gifs }, { headers: noStore });
}
