import React, { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import Animated, { LinearTransition } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useColors, useTheme } from '@/contexts/ThemeContext';
import { ActionSheet, Avatar, SheetAction, tap, useEntering } from '@/components/ui';
import { clearChatForMe, isMuted, markChatRead, setChatPrefs } from '@/services/chats';
import { chatTime } from '@/utils/format';
import { humanError } from '@/utils/errors';
import { useT } from '@/i18n';
import type { ChatListItem } from '@/types';

export const chatName = (item: ChatListItem, fallback: string) =>
  item.is_group ? item.title ?? fallback : item.peer_display_name ?? fallback;

export function ChatRow({ item, index, preview, myId, onOpen, onLongPress }: { item: ChatListItem; index: number; preview: string; myId: string; onOpen: () => void; onLongPress: () => void }) {
  const c = useColors();
  const t = useT();
  const { fs, animations } = useTheme();
  const entering = useEntering();
  const name = chatName(item, t('chats.deletedAccount'));
  const muted = isMuted(item.muted_until);
  const own = item.last_sender_id === myId && !item.last_deleted && !!item.last_ciphertext;
  const read = own && !!item.peer_last_read_at && !!item.last_created_at && item.peer_last_read_at >= item.last_created_at;

  return (
    <Animated.View entering={entering(index * 30)} layout={animations ? LinearTransition.springify().damping(20) : undefined}>
      <Pressable
        onPress={onOpen}
        onLongPress={onLongPress}
        delayLongPress={280}
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: pressed ? c.surface : item.pinned_at ? c.primarySoft : 'transparent' })}
      >
        <Avatar name={name} seed={item.peer_id ?? item.chat_id} size={56} online={item.peer_is_online} />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ color: c.text, fontSize: fs(16), fontWeight: '700', flexShrink: 1 }} numberOfLines={1}>
              {name}
            </Text>
            {muted ? <Ionicons name="volume-mute" size={14} color={c.textMuted} style={{ marginLeft: 6 }} /> : null}
            <View style={{ flex: 1 }} />
            {own ? <Ionicons name={read ? 'checkmark-done' : 'checkmark'} size={16} color={read ? c.neon : c.textMuted} style={{ marginRight: 4 }} /> : null}
            <Text style={{ color: item.unread_count > 0 && !muted ? c.primary : c.textMuted, fontSize: 12 }}>{chatTime(item.last_message_at)}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
            <Text style={{ color: c.textMuted, fontSize: fs(14), flex: 1 }} numberOfLines={1}>
              {preview}
            </Text>
            {item.unread_count > 0 ? (
              <View style={{ minWidth: 22, height: 22, borderRadius: 11, backgroundColor: muted ? c.textMuted : c.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6, marginLeft: 8 }}>
                <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>{item.unread_count > 99 ? '99+' : item.unread_count}</Text>
              </View>
            ) : item.pinned_at ? (
              <Ionicons name="pin" size={14} color={c.primary} style={{ marginLeft: 8 }} />
            ) : null}
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

// Long-press actions for a chat. Updates are optimistic; `onChanged` reloads from the server.
export function useChatActions(onChanged: () => void, patchLocal: (chatId: string, patch: Partial<ChatListItem> | null) => void) {
  const t = useT();
  const [target, setTarget] = useState<ChatListItem | null>(null);
  const [muteFor, setMuteFor] = useState<ChatListItem | null>(null);

  const run = async (fn: () => Promise<void>) => {
    try {
      await fn();
    } catch (e) {
      Alert.alert(t('common.error'), humanError(e));
    } finally {
      onChanged();
    }
  };

  const actionsFor = (item: ChatListItem): SheetAction[] => {
    const muted = isMuted(item.muted_until);
    const list: SheetAction[] = [
      {
        label: item.pinned_at ? t('chats.unpin') : t('chats.pin'),
        icon: item.pinned_at ? 'pin-outline' : 'pin',
        onPress: () => {
          patchLocal(item.chat_id, { pinned_at: item.pinned_at ? null : new Date().toISOString() });
          run(() => setChatPrefs(item.chat_id, { pinned: !item.pinned_at }));
        },
      },
      {
        label: item.archived_at ? t('chats.unarchive') : t('chats.archive'),
        icon: item.archived_at ? 'arrow-undo' : 'archive',
        onPress: () => {
          patchLocal(item.chat_id, { archived_at: item.archived_at ? null : new Date().toISOString() });
          run(() => setChatPrefs(item.chat_id, { archived: !item.archived_at }));
        },
      },
      muted
        ? {
            label: t('chats.unmute'),
            icon: 'volume-high',
            onPress: () => {
              patchLocal(item.chat_id, { muted_until: null });
              run(() => setChatPrefs(item.chat_id, { mutedUntil: null }));
            },
          }
        : { label: t('chats.mute'), icon: 'volume-mute', onPress: () => setTimeout(() => setMuteFor(item), 250) },
    ];
    if (item.unread_count > 0) {
      list.push({
        label: t('chats.markRead'),
        icon: 'checkmark-done',
        onPress: () => {
          patchLocal(item.chat_id, { unread_count: 0 });
          run(() => markChatRead(item.chat_id));
        },
      });
    }
    list.push({
      label: t('chats.deleteForMe'),
      icon: 'trash',
      danger: true,
      onPress: () =>
        Alert.alert(t('chats.deleteTitle'), t('chats.deleteText'), [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('common.delete'),
            style: 'destructive',
            onPress: () => {
              patchLocal(item.chat_id, null);
              run(() => clearChatForMe(item.chat_id));
            },
          },
        ]),
    });
    return list;
  };

  const muteOption = (label: string, hours: number | null): SheetAction => ({
    label,
    icon: hours === null ? 'notifications-off' : 'time-outline',
    onPress: () => {
      const until = hours === null ? new Date('2999-01-01T00:00:00Z') : new Date(Date.now() + hours * 3600_000);
      if (muteFor) {
        const chatId = muteFor.chat_id;
        patchLocal(chatId, { muted_until: until.toISOString() });
        run(() => setChatPrefs(chatId, { mutedUntil: until }));
      }
    },
  });

  const sheets = (
    <>
      <ActionSheet visible={!!target} title={target ? chatName(target, t('chats.deletedAccount')) : undefined} actions={target ? actionsFor(target) : []} onClose={() => setTarget(null)} />
      <ActionSheet
        visible={!!muteFor}
        title={t('chats.muteFor')}
        actions={[muteOption(t('chats.mute1h'), 1), muteOption(t('chats.mute8h'), 8), muteOption(t('chats.mute1d'), 24), muteOption(t('chats.muteForever'), null)]}
        onClose={() => setMuteFor(null)}
      />
    </>
  );

  return {
    open: (item: ChatListItem) => {
      tap();
      setTarget(item);
    },
    sheets,
  };
}
