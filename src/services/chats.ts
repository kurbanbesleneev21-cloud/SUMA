import { sb } from '@/lib/supabase';
import { encryptText, decryptText, KeyPair } from '@/crypto/box';
import type { ChatListItem, DecryptedMessage, MessageRow } from '@/types';
import { decodePayload, encodePayload, Payload } from './payload';
import { deleteAttachmentObjects } from './attachments';
import { t } from '@/i18n';

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

export const decryptRow = (row: MessageRow, keys: KeyPair): DecryptedMessage => {
  const plain = row.deleted_at
    ? null
    : decryptText({ ciphertext: row.ciphertext, nonce: row.nonce, senderKey: row.sender_key, recipientKey: row.recipient_key }, keys);
  const payload = plain === null ? null : decodePayload(plain, row.chat_id);
  return { ...row, text: payload ? payload.text : null, payload };
};

export const fetchMessages = async (chatId: string, before?: string): Promise<MessageRow[]> => {
  let q = sb().from('messages').select('*').eq('chat_id', chatId).order('created_at', { ascending: false }).limit(PAGE);
  if (before) q = q.lt('created_at', before);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as MessageRow[];
};

// Messages newer than `after`, oldest first; used to catch up on realtime events missed during reconnects.
export const fetchMessagesAfter = async (chatId: string, after: string): Promise<MessageRow[]> => {
  const { data, error } = await sb().from('messages').select('*').eq('chat_id', chatId).gt('created_at', after).order('created_at', { ascending: true }).limit(100);
  if (error) throw error;
  return (data ?? []) as MessageRow[];
};

const validate = (p: Payload): Payload => {
  const text = p.text.trim();
  if (!text && !p.att.length) throw new Error('empty message');
  if (text.length > MAX_MESSAGE_LENGTH) throw new Error(t('chat.tooLong', { max: MAX_MESSAGE_LENGTH }));
  return { text, att: p.att };
};

const seal = (payload: Payload, keys: KeyPair, peerPublicKey: string) => encryptText(encodePayload(validate(payload)), keys, peerPublicKey);

export const sendMessage = async (p: {
  chatId: string;
  payload: Payload;
  keys: KeyPair;
  peerPublicKey: string;
  replyTo?: string | null;
}): Promise<MessageRow> => {
  const env = seal(p.payload, p.keys, p.peerPublicKey);
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

export const editMessage = async (p: { id: string; payload: Payload; keys: KeyPair; peerPublicKey: string }) => {
  const env = seal(p.payload, p.keys, p.peerPublicKey);
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

// Deleting for everyone also removes the encrypted files from storage.
export const deleteMessage = async (message: { id: string; payload: Payload | null }) => {
  const { error } = await sb()
    .from('messages')
    .update({ ciphertext: '', deleted_at: new Date().toISOString() })
    .eq('id', message.id);
  if (error) throw error;
  if (message.payload?.att.length) await deleteAttachmentObjects(message.payload.att).catch(() => {});
};

export const fetchPeerReadAt = async (chatId: string, peerId: string): Promise<string | null> => {
  const { data, error } = await sb().rpc('peer_read_at', { c: chatId, peer: peerId });
  if (error) throw error;
  return (data as string | null) ?? null;
};

export const setChatPrefs = async (
  chatId: string,
  prefs: { pinned?: boolean; archived?: boolean; mutedUntil?: Date | null },
) => {
  const { error } = await sb().rpc('set_chat_prefs', {
    c: chatId,
    pinned: prefs.pinned ?? null,
    archived: prefs.archived ?? null,
    muted_until: prefs.mutedUntil ? prefs.mutedUntil.toISOString() : null,
    unmute: prefs.mutedUntil === null,
  });
  if (error) throw error;
};

export const clearChatForMe = async (chatId: string) => {
  const { error } = await sb().rpc('clear_chat_for_me', { c: chatId });
  if (error) throw error;
};

export const isMuted = (mutedUntil: string | null) => !!mutedUntil && new Date(mutedUntil).getTime() > Date.now();

export const fetchChatPeer = async (chatId: string, myId: string): Promise<string | null> => {
  const { data, error } = await sb().from('chat_members').select('user_id').eq('chat_id', chatId).neq('user_id', myId).limit(1);
  if (error) throw error;
  return (data?.[0]?.user_id as string | undefined) ?? null;
};
