// Hand-written database types for the TinyTweet Supabase schema.
// Keep in sync with supabase/migrations/0001_init.sql.

export type Profile = {
  id: string;
  username: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
};

export type Post = {
  id: string;
  user_id: string;
  content: string;
  image_url: string | null;
  like_count: number;
  reply_count: number;
  created_at: string;
};

export type Reply = {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  parent_reply_id: string | null;
  created_at: string;
};

export type Like = {
  user_id: string;
  post_id: string;
  created_at: string;
};

export type Follow = {
  follower_id: string;
  following_id: string;
  created_at: string;
};

// ---- Enriched shapes returned by joined queries ----

/** A post with its author profile joined in, plus per-viewer metadata. */
export type PostWithAuthor = Post & {
  author: Profile;
  /** Whether the current viewer has liked this post. */
  liked_by_me: boolean;
};

/** A reply with its author profile joined in. */
export type ReplyWithAuthor = Reply & {
  author: Profile;
};

/** Profile plus counts + whether the viewer follows this profile. */
export type ProfileWithStats = Profile & {
  followers_count: number;
  following_count: number;
  posts_count: number;
  followed_by_me: boolean;
};

// ---- Typed Supabase Database definition ----

type Timestamped = { created_at: string };

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: {
          id: string;
          username: string;
          display_name?: string | null;
          bio?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<Profile, "id">>;
        Relationships: [];
      };
      posts: {
        Row: Post;
        Insert: {
          id?: string;
          user_id: string;
          content: string;
          image_url?: string | null;
          like_count?: number;
          reply_count?: number;
          created_at?: string;
        };
        Update: Partial<Omit<Post, "id" | "user_id">>;
        Relationships: [];
      };
      replies: {
        Row: Reply;
        Insert: {
          id?: string;
          post_id: string;
          user_id: string;
          content: string;
          parent_reply_id?: string | null;
          created_at?: string;
        };
        Update: Partial<Pick<Reply, "content">>;
        Relationships: [];
      };
      likes: {
        Row: Like;
        Insert: { user_id: string; post_id: string; created_at?: string };
        Update: Partial<Like>;
        Relationships: [];
      };
      follows: {
        Row: Follow;
        Insert: {
          follower_id: string;
          following_id: string;
          created_at?: string;
        };
        Update: Partial<Follow> & Timestamped;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
