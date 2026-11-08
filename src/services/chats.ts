import { sb } from '@/lib/supabase';
import { encryptText, decryptText, KeyPair } from '@/crypto/box';
import type { ChatListItem, DecryptedMessage, MessageRow } from '@/types';

export const MAX_MESSAGE_LENGTH = 4000;
const PAGE = 40;

export const fetchMyChats = async (): Promise<ChatListItem[]> => {
  const { data, error } = await sb().rpc('my_chats');
  if (error) throw error;
  return (data ?? []) as ChatListItem[];
};

export const openDirectChat = async (otherUserId: string): Promise<string> => {
  const { data, error } = await sb().rpc('create_direct_chat', { other: otherUserId });
  if (error) throw error;
  return data as string;
};

export const markChatRead = async (chatId: string) => {
  await sb().rpc('mark_chat_read', { c: chatId });
};

export const decryptRow = (row: MessageRow, keys: KeyPair): DecryptedMessage => ({
  ...row,
  text: row.deleted_at ? null : decryptText(
    { ciphertext: row.ciphertext, nonce: row.nonce, senderKey: row.sender_key, recipientKey: row.recipient_key },
    keys,
  ),
});

export const fetchMessages = async (chatId: string, before?: string): Promise<MessageRow[]> => {
  let q = sb().from('messages').select('*').eq('chat_id', chatId).order('created_at', { ascending: false }).limit(PAGE);
  if (before) q = q.lt('created_at', before);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as MessageRow[];
};

const validate = (text: string) => {
  const t = text.trim();
  if (!t) throw new Error('empty message');
  if (t.length > MAX_MESSAGE_LENGTH) throw new Error(`Сообщение длиннее ${MAX_MESSAGE_LENGTH} символов`);
  return t;
};

export const sendMessage = async (p: {
  chatId: string;
  text: string;
  keys: KeyPair;
  peerPublicKey: string;
  replyTo?: string | null;
}): Promise<MessageRow> => {
  const env = encryptText(validate(p.text), p.keys, p.peerPublicKey);
  const { data, error } = await sb()
    .from('messages')
    .insert({
      chat_id: p.chatId,
      ciphertext: env.ciphertext,
      nonce: env.nonce,
      sender_key: env.senderKey,
      recipient_key: env.recipientKey,
      reply_to: p.replyTo ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as MessageRow;
};

export const editMessage = async (p: { id: string; text: string; keys: KeyPair; peerPublicKey: string }) => {
  const env = encryptText(validate(p.text), p.keys, p.peerPublicKey);
  const { data, error } = await sb()
    .from('messages')
    .update({
      ciphertext: env.ciphertext,
      nonce: env.nonce,
      sender_key: env.senderKey,
      recipient_key: env.recipientKey,
      edited_at: new Date().toISOString(),
    })
    .eq('id', p.id)
    .select()
    .single();
  if (error) throw error;
  return data as MessageRow;
};

export const deleteMessage = async (id: string) => {
  const { error } = await sb()
    .from('messages')
    .update({ ciphertext: '', deleted_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
};

export const fetchPeerReadAt = async (chatId: string, peerId: string): Promise<string | null> => {
  const { data } = await sb()
    .from('chat_members')
    .select('last_read_at')
    .eq('chat_id', chatId)
    .eq('user_id', peerId)
    .maybeSingle();
  return (data?.last_read_at as string | undefined) ?? null;
};

export const fetchChatPeer = async (chatId: string, myId: string): Promise<string | null> => {
  const { data, error } = await sb().from('chat_members').select('user_id').eq('chat_id', chatId).neq('user_id', myId).limit(1);
  if (error) throw error;
  return (data?.[0]?.user_id as string | undefined) ?? null;
};
