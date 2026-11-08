import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { useColors } from '@/contexts/ThemeContext';
import { Avatar, EmptyState, ErrorBanner, Field, Header, IconButton, Loading } from '@/components/ui';
import { fetchMyChats } from '@/services/chats';
import { decryptText } from '@/crypto/box';
import { sb } from '@/lib/supabase';
import { chatTime, isOnline } from '@/utils/format';
import { humanError } from '@/utils/errors';
import type { ChatListItem } from '@/types';

export default function ChatsScreen() {
  const c = useColors();
  const router = useRouter();
  const { keys, session } = useAuth();
  const myId = session!.user.id;
  const [chats, setChats] = useState<ChatListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    try {
      setChats(await fetchMyChats());
      setError(null);
    } catch (e) {
      setError(humanError(e));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  useEffect(() => {
    const channel = sb()
      .channel('chat-list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => {
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(load, 300);
      })
      .subscribe();
    return () => {
      sb().removeChannel(channel);
    };
  }, [load]);

  const preview = useCallback(
    (item: ChatListItem) => {
      if (!item.last_ciphertext && !item.last_deleted) return 'Нет сообщений';
      if (item.last_deleted) return 'Сообщение удалено';
      if (!keys) return '…';
      const text = decryptText(
        { ciphertext: item.last_ciphertext!, nonce: item.last_nonce!, senderKey: item.last_sender_key!, recipientKey: item.last_recipient_key! },
        keys,
      );
      const body = text ?? '🔒 Не удалось расшифровать';
      return item.last_sender_id === myId ? `Вы: ${body}` : body;
    },
    [keys, myId],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!chats || !q) return chats ?? [];
    return chats.filter((ch) => `${ch.peer_display_name ?? ''} ${ch.peer_username ?? ''} ${ch.title ?? ''}`.toLowerCase().includes(q));
  }, [chats, query]);

  if (chats === null && !error) return <Loading />;

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <Header title="Чаты" right={<IconButton icon="create-outline" label="Новый чат" filled onPress={() => router.push('/contacts')} />} />
      <View style={{ paddingHorizontal: 16 }}>
        <Field icon="search" placeholder="Поиск по чатам" value={query} onChangeText={setQuery} autoCapitalize="none" />
      </View>
      {error ? <ErrorBanner message={error} onRetry={load} /> : null}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.chat_id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={c.primary}
            colors={[c.primary]}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
          />
        }
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 16 }}
        ListEmptyComponent={
          query ? (
            <EmptyState icon="search" title="Ничего не найдено" />
          ) : (
            <EmptyState icon="chatbubbles" title="Пока нет переписок" text="Найдите собеседника по username во вкладке «Контакты» и начните общение." />
          )
        }
        renderItem={({ item }) => {
          const name = item.is_group ? item.title ?? 'Группа' : item.peer_display_name ?? 'Удалённый аккаунт';
          return (
            <Pressable
              onPress={() => router.push({ pathname: '/chat/[id]', params: { id: item.chat_id } })}
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: pressed ? c.surface : 'transparent' })}
            >
              <Avatar name={name} seed={item.peer_id ?? item.chat_id} size={54} online={isOnline(item.peer_last_seen_at)} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ color: c.text, fontSize: 16, fontWeight: '700', flex: 1 }} numberOfLines={1}>
                    {name}
                  </Text>
                  <Text style={{ color: item.unread_count > 0 ? c.primary : c.textMuted, fontSize: 12 }}>{chatTime(item.last_message_at)}</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                  <Text style={{ color: c.textMuted, fontSize: 14, flex: 1 }} numberOfLines={1}>
                    {preview(item)}
                  </Text>
                  {item.unread_count > 0 ? (
                    <View style={{ minWidth: 22, height: 22, borderRadius: 11, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6, marginLeft: 8 }}>
                      <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>{item.unread_count > 99 ? '99+' : item.unread_count}</Text>
                    </View>
                  ) : (
                    <Ionicons name="lock-closed" size={12} color={c.textMuted} style={{ marginLeft: 8 }} />
                  )}
                </View>
              </View>
            </Pressable>
          );
        }}
      />
    </View>
  );
}
