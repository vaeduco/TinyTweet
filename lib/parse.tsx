import Link from "next/link";
import React from "react";

// Order matters: hashtags, mentions, then URLs.
const PATTERN = /(#[A-Za-z0-9_]+)|(@[A-Za-z0-9_]+)|(https?:\/\/[^\s<]+)/g;

/**
 * Renders post/reply text as safe React nodes with clickable #hashtags,
 * @mentions and URLs. Text is rendered as React children, so it is always
 * escaped — there is no dangerouslySetInnerHTML and therefore no XSS surface.
 */
export function renderContent(text: string): React.ReactNode {
  if (!text) return null;

  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;

  for (const match of text.matchAll(PATTERN)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      nodes.push(text.slice(lastIndex, index));
    }

    const token = match[0];
    if (token.startsWith("#")) {
      const tag = token.slice(1).toLowerCase();
      nodes.push(
        <Link
          key={key++}
          href={`/hashtag/${tag}`}
          className="font-medium text-primary hover:underline"
        >
          {token}
        </Link>
      );
    } else if (token.startsWith("@")) {
      const username = token.slice(1).toLowerCase();
      nodes.push(
        <Link
          key={key++}
          href={`/${username}`}
          className="font-medium text-primary hover:underline"
        >
          {token}
        </Link>
      );
    } else {
      nodes.push(
        <a
          key={key++}
          href={token}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="text-primary hover:underline break-anywhere"
        >
          {token}
        </a>
      );
    }

    lastIndex = index + token.length;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}

/** Extract unique lowercased hashtags from text (without the leading #). */
export function extractHashtags(text: string): string[] {
  const tags = new Set<string>();
  for (const m of text.matchAll(/#([A-Za-z0-9_]+)/g)) {
    tags.add(m[1].toLowerCase());
  }
  return Array.from(tags);
}

/** Extract unique lowercased @mentions from text (without the leading @). */
export function extractMentions(text: string): string[] {
  const mentions = new Set<string>();
  for (const m of text.matchAll(/@([A-Za-z0-9_]+)/g)) {
    mentions.add(m[1].toLowerCase());
  }
  return Array.from(mentions);
}
