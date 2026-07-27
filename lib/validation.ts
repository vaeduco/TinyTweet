// Usernames that collide with real routes or are otherwise reserved.
export const RESERVED_USERNAMES = new Set([
  "login",
  "signup",
  "logout",
  "signout",
  "search",
  "hashtag",
  "post",
  "settings",
  "admin",
  "about",
  "api",
  "auth",
  "explore",
  "home",
  "notifications",
  "messages",
  "help",
  "terms",
  "privacy",
  "tinytweet",
  "support",
  "new",
  "edit",
  "profile",
  "me",
  "user",
  "static",
  "public",
  "assets",
]);

/** Returns an error string if invalid, or null if the username is acceptable. */
export function validateUsername(username: string): string | null {
  const u = username.trim().toLowerCase();
  if (!/^[a-z0-9_]{3,20}$/.test(u)) {
    return "Username must be 3–20 characters: lowercase letters, numbers, or underscores.";
  }
  if (RESERVED_USERNAMES.has(u)) {
    return "That username is reserved. Please choose another.";
  }
  return null;
}

export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}
