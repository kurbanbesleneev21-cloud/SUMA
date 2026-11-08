export interface Profile {
  id: string;
  username: string;
  display_name: string;
  bio: string;
  avatar_url: string | null;
  public_key: string | null;
  created_at: string;
}

export interface ChatListItem {
  chat_id: string;
  is_group: boolean;
  title: string | null;
  last_message_at: string;
  unread_count: number;
  pinned_at: string | null;
  archived_at: string | null;
  muted_until: string | null;
  peer_id: string | null;
  peer_username: string | null;
  peer_display_name: string | null;
  peer_avatar_url: string | null;
  peer_is_online: boolean | null;
  peer_last_seen_at: string | null;
  peer_last_read_at: string | null;
  last_message_id: string | null;
  last_sender_id: string | null;
  last_created_at: string | null;
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
  payload: import('@/services/payload').Payload | null;
}

export type Visibility = 'everyone' | 'contacts' | 'nobody';

export interface UserSettings {
  user_id: string;
  last_seen_visibility: Visibility;
  online_visibility: Visibility;
  avatar_visibility: Visibility;
  who_can_message: Visibility;
  who_can_call: Visibility;
  who_can_add_to_groups: Visibility;
  read_receipts: boolean;
  notify_enabled: boolean;
  notify_private: boolean;
  notify_groups: boolean;
  notify_sound: boolean;
  notify_vibrate: boolean;
  notify_preview: boolean;
}
