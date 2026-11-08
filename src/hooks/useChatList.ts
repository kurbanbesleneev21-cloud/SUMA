import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { sb } from '@/lib/supabase';
import { fetchMyChats } from '@/services/chats';
import { decryptText, KeyPair } from '@/crypto/box';
import { humanError } from '@/utils/errors';
import { t } from '@/i18n';
import type { ChatListItem } from '@/types';

export const chatPreview = (item: ChatListItem, keys: KeyPair | null, myId: string) => {
  if (item.last_deleted) return t('chat.deleted');
  if (!item.last_ciphertext) return t('chats.noMessages');
  if (!keys) return '…';
  const text = decryptText(
    { ciphertext: item.last_ciphertext, nonce: item.last_nonce!, senderKey: item.last_sender_key!, recipientKey: item.last_recipient_key! },
    keys,
  );
  const body = text ?? `🔒 ${t('chat.cannotDecryptShort')}`;
  return item.last_sender_id === myId ? `${t('chats.you')}: ${body}` : body;
};

// Chat list with realtime refresh. A single debounced reload covers inserts, edits and read receipts.
export function useChatList() {
  const [chats, setChats] = useState<ChatListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    try {
      setChats(await fetchMyChats());
      setError(null);
    } catch (e) {
      setError(humanError(e));
    }
  }, []);

  const scheduleReload = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(load, 300);
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  useEffect(() => {
    const channel = sb()
      .channel(`chat-list-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, scheduleReload)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chat_members' }, scheduleReload)
      .subscribe();
    const presence = setInterval(load, 60_000);
    return () => {
      sb().removeChannel(channel);
      clearInterval(presence);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [load, scheduleReload]);

  return { chats, setChats, error, reload: load };
}
