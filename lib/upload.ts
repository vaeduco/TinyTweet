import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/types";

/**
 * Upload a file into `<userId>/...` of a public bucket and return its public
 * URL. The per-user folder matches the storage RLS policies (a user may only
 * write inside a folder named after their own uid). Throws on failure.
 */
export async function uploadToBucket(
  supabase: SupabaseClient<Database>,
  bucket: string,
  userId: string,
  file: Blob,
  ext: string
): Promise<string> {
  // Random filename → the URL can't be guessed/enumerated (the buckets are
  // public-read, so an unguessable path is the confidentiality boundary).
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || undefined,
  });
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}
