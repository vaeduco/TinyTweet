import type { MetadataRoute } from "next";
import { APP_NAME } from "@/lib/constants";

// A minimal web app manifest so the app is installable — required for iOS
// (Safari) Web Push, and nice-to-have for Android/desktop install prompts.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP_NAME,
    short_name: APP_NAME,
    description: "A tiny micro-blog.",
    start_url: "/",
    display: "standalone",
    background_color: "#0b0f19",
    theme_color: "#0b0f19",
    icons: [
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
  };
}
