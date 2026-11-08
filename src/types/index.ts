export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface UserProfile {
  id: string;
  email: string;
  username: string;
  full_name: string;
  avatar_url?: string;
  status?: 'online' | 'offline' | 'away';
  status_message?: string;
  created_at: string;
  updated_at: string;
}

export interface PrivateChat {
  id: string;
  created_at: string;
  updated_at: string;
  last_message?: Message;
  last_message_at?: string;
}

export interface ChatMember {
  id: string;
  chat_id: string;
  user_id: string;
  joined_at: string;
  last_read_at?: string;
  user?: UserProfile;
}

export interface GroupChat {
  id: string;
  name: string;
  description?: string;
  avatar_url?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  is_group: true;
}

export interface Chat {
  id: string;
  is_group: boolean;
  name?: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
  unread_count?: number;
}

export interface Message {
  id: string;
  chat_id: string;
  sender_id: string;
  content: string;
  encrypted_content?: string;
  file_encryption_key?: string;
  message_type: 'text' | 'image' | 'video' | 'audio' | 'file';
  created_at: string;
  updated_at: string;
  deleted_at?: string;
  is_edited: boolean;
  reply_to_id?: string;
  sender?: UserProfile;
  attachment?: MessageAttachment;
}

export interface MessageAttachment {
  id: string;
  message_id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  file_url: string;
  encrypted_file_key?: string;
  created_at: string;
}

export interface MessageRead {
  id: string;
  message_id: string;
  user_id: string;
  read_at: string;
}

export interface MessageReaction {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
}

export interface UserBlock {
  id: string;
  user_id: string;
  blocked_user_id: string;
  created_at: string;
}

export interface UserDevice {
  id: string;
  user_id: string;
  device_id: string;
  public_key: string;
  device_name: string;
  device_type: string;
  last_seen_at: string;
  created_at: string;
}

export interface EncryptionKeys {
  privateKey: Uint8Array;
  publicKey: Uint8Array;
  secretKey?: Uint8Array;
}

export interface ChatEncryptionKey {
  id: string;
  chat_id: string;
  user_id: string;
  encrypted_key: string;
  created_at: string;
}
