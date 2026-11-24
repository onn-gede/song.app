export type WishlistSong = {
  id: string;
  title: string;
  default_key: string | null;
  youtube_url?: string | null;
  lyrics_text?: string | null;
  verse_count?: number | null;
};

export type WishlistItem = {
  id: string;
  position: number;
  notes: string | null;
  song: WishlistSong;
};

export type Wishlist = {
  id: string;
  name: string;
  notes: string | null;
  updated_at: string;
  is_public: boolean;
  public_slug: string | null;
  items: WishlistItem[];
};

export type WishlistMutationResult = Wishlist & {
  public_slug?: string | null;
};

export type MoveWishlistSongInput = {
  playlistId: string;
  itemId: string;
  meetingId: string;
  isBackup?: boolean;
  selectedKey?: string;
};
