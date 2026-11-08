import React, { useMemo } from 'react';
import { FlatList, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useColors } from '@/contexts/ThemeContext';
import { EmptyState, ErrorBanner, Header, Loading } from '@/components/ui';
import { ChatRow, useChatActions } from '@/components/ChatRow';
import { chatPreview, useChatList } from '@/hooks/useChatList';
import { useT } from '@/i18n';
import type { ChatListItem } from '@/types';

export default function ArchiveScreen() {
  const c = useColors();
  const t = useT();
  const router = useRouter();
  const { keys, session } = useAuth();
  const myId = session!.user.id;
  const { chats, setChats, error, reload } = useChatList();
  const patchLocal = (chatId: string, patch: Partial<ChatListItem> | null) =>
    setChats((list) => (list ?? []).flatMap((ch) => (ch.chat_id !== chatId ? [ch] : patch === null ? [] : [{ ...ch, ...patch }])));
  const actions = useChatActions(reload, patchLocal);
  const archived = useMemo(() => (chats ?? []).filter((ch) => ch.archived_at), [chats]);

  if (chats === null && !error) return <Loading />;

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <Header title={t('chats.archiveTitle')} back />
      {error ? <ErrorBanner message={error} onRetry={reload} /> : null}
      <FlatList
        data={archived}
        keyExtractor={(item) => item.chat_id}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }}
        ListEmptyComponent={<EmptyState icon="archive" title={t('chats.archiveEmpty')} text={t('chats.archiveHint')} />}
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
