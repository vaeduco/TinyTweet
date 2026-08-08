// Hand-written database types for the TinyTweet Supabase schema.
// Keep in sync with supabase/migrations/0001_init.sql.

export type DmPrivacy = "everyone" | "following" | "none";

export type Profile = {
  id: string;
  username: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  notify_follows: boolean;
  notify_likes: boolean;
  notify_replies: boolean;
  notify_mentions: boolean;
  dm_privacy: DmPrivacy;
  is_private: boolean;
  created_at: string;
  updated_at: string;
  last_seen_at: string | null;
};

export type Block = {
  blocker_id: string;
  blocked_id: string;
  created_at: string;
};

export type Post = {
  id: string;
  user_id: string;
  content: string;
  image_url: string | null;
  like_count: number;
  reply_count: number;
  is_pinned: boolean;
  pinned_at: string | null;
  created_at: string;
};

export type ReplyAttachmentType = "image" | "gif";

export type Reply = {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  parent_reply_id: string | null;
  attachment_url: string | null;
  attachment_type: ReplyAttachmentType | null;
  created_at: string;
};

export type Like = {
  user_id: string;
  post_id: string;
  created_at: string;
};

export type SavedPost = {
  user_id: string;
  post_id: string;
  category_id: string | null;
  created_at: string;
};

export type BookmarkCategory = {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
};

export type Poll = {
  id: string;
  post_id: string;
  ends_at: string;
  created_at: string;
};

export type PollOption = {
  id: string;
  poll_id: string;
  text: string;
  position: number;
  vote_count: number;
};

export type PollVote = {
  poll_id: string;
  option_id: string;
  user_id: string;
  created_at: string;
};

/** A poll with its options, the viewer's own vote, and the total tally. */
export type PollWithMeta = Poll & {
  options: PollOption[];
  /** The option the viewer voted for, or null if they haven't voted. */
  my_vote_option_id: string | null;
  total_votes: number;
};

export type FollowStatus = "pending" | "accepted";
/** The viewer's follow state toward another account. */
export type FollowState = "none" | FollowStatus;

export type Follow = {
  follower_id: string;
  following_id: string;
  status: FollowStatus;
  created_at: string;
};

export type NotificationType =
  | "follow"
  | "follow_request"
  | "like"
  | "reply"
  | "mention";

export type Notification = {
  id: string;
  user_id: string; // recipient
  type: NotificationType;
  actor_id: string; // who triggered it
  reference_id: string | null; // related post id (null for follow)
  reply_id: string | null; // originating reply id (reply / mention-in-reply)
  is_read: boolean;
  created_at: string;
};

// ---- Enriched shapes returned by joined queries ----

/** A post with its author profile joined in, plus per-viewer metadata. */
export type PostWithAuthor = Post & {
  author: Profile;
  /** Whether the current viewer has liked this post. */
  liked_by_me: boolean;
  /** Whether the current viewer has bookmarked this post. */
  saved_by_me: boolean;
  /** The category the viewer saved it in (null = uncategorized, or not saved). */
  saved_category_id: string | null;
  /** The attached poll, or null if this post has none. */
  poll: PollWithMeta | null;
};

/** A reply with its author profile joined in. */
export type ReplyWithAuthor = Reply & {
  author: Profile;
};

/** A notification with the acting user's profile joined in. */
export type NotificationWithActor = Notification & {
  actor: Profile;
};

// ---- Messaging ----

export type Conversation = {
  id: string;
  is_group: boolean;
  name: string | null;
  created_by: string | null;
  created_at: string;
  last_message_at: string;
  last_message_preview: string | null;
  last_message_sender_id: string | null;
};

export type ConversationParticipant = {
  conversation_id: string;
  user_id: string;
  joined_at: string;
  last_read_at: string;
  is_archived: boolean;
  deleted_at: string | null;
  is_muted: boolean;
  is_pinned: boolean;
  pinned_at: string | null;
};

export type MessageStatus = "sent" | "delivered";

export type MessageAttachmentType = "image" | "gif" | "audio";

export type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  status: MessageStatus;
  attachment_url: string | null;
  attachment_type: MessageAttachmentType | null;
  duration_seconds: number | null;
  deleted_at: string | null;
  created_at: string;
};

export type MessageWithSender = Message & { sender: Profile };

/** A conversation enriched for the inbox and thread header. */
export type ConversationWithMeta = Conversation & {
  participants: Profile[]; // all members, including the viewer
  others: Profile[]; // members excluding the viewer
  unread: boolean;
  // The viewer's per-user flags (from their participant row).
  is_archived: boolean;
  is_muted: boolean;
  is_pinned: boolean;
  pinned_at: string | null;
};

/** Profile plus counts + whether the viewer follows this profile. */
export type ProfileWithStats = Profile & {
  followers_count: number;
  following_count: number;
  posts_count: number;
  followed_by_me: boolean;
  /** The viewer's follow state toward this profile (none / pending / accepted). */
  follow_status: FollowState;
  blocked_by_me: boolean;
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
          cover_url?: string | null;
          notify_follows?: boolean;
          notify_likes?: boolean;
          notify_replies?: boolean;
          notify_mentions?: boolean;
          dm_privacy?: DmPrivacy;
          is_private?: boolean;
          created_at?: string;
          updated_at?: string;
          last_seen_at?: string | null;
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
          is_pinned?: boolean;
          pinned_at?: string | null;
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
          attachment_url?: string | null;
          attachment_type?: ReplyAttachmentType | null;
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
      bookmark_categories: {
        Row: BookmarkCategory;
        Insert: { id?: string; user_id: string; name: string; created_at?: string };
        Update: Partial<BookmarkCategory>;
        Relationships: [];
      };
      saved_posts: {
        Row: SavedPost;
        Insert: {
          user_id: string;
          post_id: string;
          category_id?: string | null;
          created_at?: string;
        };
        Update: Partial<SavedPost>;
        Relationships: [];
      };
      polls: {
        Row: Poll;
        Insert: {
          id?: string;
          post_id: string;
          ends_at: string;
          created_at?: string;
        };
        Update: Partial<Poll>;
        Relationships: [];
      };
      poll_options: {
        Row: PollOption;
        Insert: {
          id?: string;
          poll_id: string;
          text: string;
          position: number;
          vote_count?: number;
        };
        Update: Partial<PollOption>;
        Relationships: [];
      };
      poll_votes: {
        Row: PollVote;
        Insert: {
          poll_id: string;
          option_id: string;
          user_id: string;
          created_at?: string;
        };
        Update: Partial<PollVote>;
        Relationships: [];
      };
      blocks: {
        Row: Block;
        Insert: { blocker_id: string; blocked_id: string; created_at?: string };
        Update: Partial<Block>;
        Relationships: [];
      };
      follows: {
        Row: Follow;
        Insert: {
          follower_id: string;
          following_id: string;
          status?: FollowStatus;
          created_at?: string;
        };
        Update: Partial<Follow> & Timestamped;
        Relationships: [];
      };
      notifications: {
        Row: Notification;
        Insert: {
          id?: string;
          user_id: string;
          type: NotificationType;
          actor_id: string;
          reference_id?: string | null;
          reply_id?: string | null;
          is_read?: boolean;
          created_at?: string;
        };
        Update: Partial<Pick<Notification, "is_read">>;
        Relationships: [];
      };
      conversations: {
        Row: Conversation;
        Insert: {
          id?: string;
          is_group?: boolean;
          name?: string | null;
          created_by?: string | null;
          created_at?: string;
          last_message_at?: string;
          last_message_preview?: string | null;
          last_message_sender_id?: string | null;
        };
        Update: Partial<Conversation>;
        Relationships: [];
      };
      conversation_participants: {
        Row: ConversationParticipant;
        Insert: {
          conversation_id: string;
          user_id: string;
          joined_at?: string;
          last_read_at?: string;
          is_archived?: boolean;
          deleted_at?: string | null;
          is_muted?: boolean;
          is_pinned?: boolean;
          pinned_at?: string | null;
        };
        Update: Partial<
          Pick<
            ConversationParticipant,
            | "last_read_at"
            | "is_archived"
            | "deleted_at"
            | "is_muted"
            | "is_pinned"
            | "pinned_at"
          >
        >;
        Relationships: [];
      };
      messages: {
        Row: Message;
        Insert: {
          id?: string;
          conversation_id: string;
          sender_id: string;
          content: string;
          status?: MessageStatus;
          attachment_url?: string | null;
          attachment_type?: MessageAttachmentType | null;
          duration_seconds?: number | null;
          created_at?: string;
        };
        Update: Partial<
          Pick<
            Message,
            | "status"
            | "content"
            | "deleted_at"
            | "attachment_url"
            | "attachment_type"
            | "duration_seconds"
          >
        >;
        Relationships: [];
      };
    };
    Views: {
      conversation_members: {
        Row: {
          conversation_id: string;
          user_id: string;
          joined_at: string;
        };
        Relationships: [];
      };
    };
    Functions: {
      create_conversation: {
        Args: {
          target_ids: string[];
          is_group_in: boolean;
          group_name: string | null;
        };
        Returns: string;
      };
      add_participants: {
        Args: { conv: string; add_ids: string[] };
        Returns: undefined;
      };
      is_conversation_participant: {
        Args: { conv: string };
        Returns: boolean;
      };
      is_group_conversation: {
        Args: { conv: string };
        Returns: boolean;
      };
      create_poll_post: {
        Args: {
          p_content: string;
          p_options: string[];
          p_duration_minutes: number;
        };
        Returns: string;
      };
      block_user: {
        Args: { p_target: string };
        Returns: undefined;
      };
      approve_follow: {
        Args: { p_requester: string };
        Returns: undefined;
      };
      reject_follow: {
        Args: { p_requester: string };
        Returns: undefined;
      };
      set_account_private: {
        Args: { p_value: boolean };
        Returns: undefined;
      };
      get_profile_counts: {
        Args: { p_profile: string };
        Returns: {
          followers_count: number;
          following_count: number;
          posts_count: number;
        }[];
      };
      set_pinned_post: {
        Args: { p_post_id: string; p_pinned: boolean };
        Returns: undefined;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
