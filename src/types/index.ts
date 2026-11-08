export interface Profile {
  id: string;
  username: string;
  display_name: string;
  bio: string;
  avatar_url: string | null;
  public_key: string | null;
  last_seen_at: string | null;
  created_at: string;
}

export interface ChatListItem {
  chat_id: string;
  is_group: boolean;
  title: string | null;
  last_message_at: string;
  unread_count: number;
  peer_id: string | null;
  peer_username: string | null;
  peer_display_name: string | null;
  peer_avatar_url: string | null;
  peer_last_seen_at: string | null;
  last_sender_id: string | null;
  last_ciphertext: string | null;
  last_nonce: string | null;
  last_sender_key: string | null;
  last_recipient_key: string | null;
  last_deleted: boolean | null;
}

export interface MessageRow {
  id: string;
  chat_id: string;
  sender_id: string;
  ciphertext: string;
  nonce: string;
  sender_key: string;
  recipient_key: string;
  reply_to: string | null;
  created_at: string;
  edited_at: string | null;
  deleted_at: string | null;
}

export interface DecryptedMessage extends MessageRow {
  text: string | null;
}
