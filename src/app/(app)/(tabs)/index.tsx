import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { useColors } from '@/contexts/ThemeContext';
import { Chip, EmptyState, ErrorBanner, Field, Header, IconButton, Loading } from '@/components/ui';
import { ChatRow, chatName, useChatActions } from '@/components/ChatRow';
import { TAB_BAR_SPACE } from '@/components/TabBar';
import { chatPreview, useChatList } from '@/hooks/useChatList';
import { useT } from '@/i18n';
import type { ChatListItem } from '@/types';

type Filter = 'all' | 'private' | 'groups' | 'channels';

export default function ChatsScreen() {
  const c = useColors();
  const t = useT();
  const router = useRouter();
  const { keys, session } = useAuth();
  const myId = session!.user.id;
  const { chats, setChats, error, reload } = useChatList();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [refreshing, setRefreshing] = useState(false);

  const patchLocal = (chatId: string, patch: Partial<ChatListItem> | null) =>
    setChats((list) => (list ?? []).flatMap((ch) => (ch.chat_id !== chatId ? [ch] : patch === null ? [] : [{ ...ch, ...patch }])));
  const actions = useChatActions(reload, patchLocal);

  const active = useMemo(() => (chats ?? []).filter((ch) => !ch.archived_at), [chats]);
  const archivedCount = (chats ?? []).length - active.length;
  const archivedUnread = (chats ?? []).filter((ch) => ch.archived_at && ch.unread_count > 0).length;

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return active
      .filter((ch) => (filter === 'private' ? !ch.is_group : filter === 'groups' ? ch.is_group : filter === 'channels' ? false : true))
      .filter((ch) => !q || `${chatName(ch, '')} ${ch.peer_username ?? ''} ${chatPreview(ch, keys, myId)}`.toLowerCase().includes(q))
      .sort((a, b) => (b.pinned_at ?? '').localeCompare(a.pinned_at ?? '') || b.last_message_at.localeCompare(a.last_message_at));
  }, [active, filter, query, keys, myId]);

  const unread = (f: Filter) =>
    active.filter((ch) => ch.unread_count > 0 && (f === 'private' ? !ch.is_group : f === 'groups' ? ch.is_group : f === 'all')).length;

  if (chats === null && !error) return <Loading />;

  const empty =
    query ? (
      <EmptyState icon="search" title={t('common.nothingFound')} />
    ) : filter === 'groups' ? (
      <EmptyState icon="albums" title={t('chats.noGroupsTitle')} text={t('chats.noGroupsText')} />
    ) : filter === 'channels' ? (
      <EmptyState icon="megaphone" title={t('chats.noChannelsTitle')} text={t('chats.noChannelsText')} />
    ) : (
      <EmptyState icon="chatbubbles" title={t('chats.emptyTitle')} text={t('chats.emptyText')} />
    );

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <Header logo right={<IconButton icon="create-outline" label={t('chats.newChat')} filled onPress={() => router.push('/new-chat')} />} />
      <View style={{ paddingHorizontal: 16 }}>
        <Field icon="search" placeholder={t('chats.search')} value={query} onChangeText={setQuery} autoCapitalize="none" />
      </View>
      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingBottom: 10 }}>
          {(['all', 'private', 'groups', 'channels'] as Filter[]).map((f) => (
            <Chip key={f} label={t(`chats.filter.${f}`)} active={filter === f} count={unread(f) || undefined} onPress={() => setFilter(f)} />
          ))}
        </ScrollView>
      </View>
      {error ? <ErrorBanner message={error} onRetry={reload} /> : null}
      <FlatList
        data={visible}
        keyExtractor={(item) => item.chat_id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={c.primary}
            colors={[c.primary]}
            onRefresh={async () => {
              setRefreshing(true);
              await reload();
              setRefreshing(false);
            }}
          />
        }
        contentContainerStyle={{ flexGrow: 1, paddingBottom: TAB_BAR_SPACE }}
        ListHeaderComponent={
          archivedCount > 0 && filter === 'all' && !query ? (
            <Pressable onPress={() => router.push('/archive')} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: pressed ? c.surface : 'transparent' })}>
              <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: c.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="archive" size={24} color={c.textMuted} />
              </View>
              <Text style={{ color: c.text, fontSize: 16, fontWeight: '700', marginLeft: 12, flex: 1 }}>{t('chats.archiveTitle')}</Text>
              <Text style={{ color: archivedUnread ? c.primary : c.textMuted, fontWeight: '600' }}>{archivedCount}</Text>
              <Ionicons name="chevron-forward" size={18} color={c.textMuted} style={{ marginLeft: 6 }} />
            </Pressable>
          ) : undefined
        }
        ListEmptyComponent={empty}
        renderItem={({ item, index }) => (
          <ChatRow
            item={item}
            index={index}
            myId={myId}
            preview={chatPreview(item, keys, myId)}
            onOpen={() => router.push({ pathname: '/chat/[id]', params: { id: item.chat_id } })}
            onLongPress={() => actions.open(item)}
          />
        )}
      />
      {actions.sheets}
    </View>
  );
}
