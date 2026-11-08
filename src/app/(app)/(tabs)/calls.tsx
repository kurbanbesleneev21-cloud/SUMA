import React, { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/contexts/ThemeContext';
import { useCalls } from '@/contexts/CallContext';
import { Avatar, Chip, EmptyState, ErrorBanner, Header, Loading, useEntering } from '@/components/ui';
import { TAB_BAR_SPACE } from '@/components/TabBar';
import { CallHistoryItem, fetchCallHistory } from '@/services/calls';
import { formatDuration } from '@/services/attachments';
import { getProfile } from '@/services/users';
import { sb } from '@/lib/supabase';
import { chatTime } from '@/utils/format';
import { humanError } from '@/utils/errors';
import { useT } from '@/i18n';

const isMissed = (c: CallHistoryItem) => !c.outgoing && (c.status === 'missed' || c.status === 'cancelled');

export default function CallsScreen() {
  const c = useColors();
  const t = useT();
  const entering = useEntering();
  const calls = useCalls();
  const [items, setItems] = useState<CallHistoryItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'missed'>('all');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setItems(await fetchCallHistory());
      setError(null);
    } catch (e) {
      setError(humanError(e));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
      const ch = sb()
        .channel('call-history')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'calls' }, () => load())
        .subscribe();
      return () => {
        sb().removeChannel(ch);
      };
    }, [load]),
  );

  const redial = async (item: CallHistoryItem, video: boolean) => {
    try {
      const peer = await getProfile(item.peer_id);
      await calls.startOutgoing({ chatId: item.chat_id, peer, video });
    } catch (e) {
      Alert.alert(t('calls.cannotCall'), humanError(e));
    }
  };

  if (items === null && !error) return <Loading />;
  const shown = (items ?? []).filter((x) => filter === 'all' || isMissed(x));

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <Header title={t('tabs.calls')} />
      <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 10 }}>
        <Chip label={t('calls.all')} active={filter === 'all'} onPress={() => setFilter('all')} />
        <Chip label={t('calls.missed')} active={filter === 'missed'} count={(items ?? []).filter(isMissed).length || undefined} onPress={() => setFilter('missed')} />
      </View>
      {error ? <ErrorBanner message={error} onRetry={load} /> : null}
      <FlatList
        data={shown}
        keyExtractor={(x) => x.id}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: TAB_BAR_SPACE }}
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
        ListEmptyComponent={<EmptyState icon="call" title={filter === 'missed' ? t('calls.noMissed') : t('calls.emptyTitle')} text={filter === 'missed' ? undefined : t('calls.emptyText')} />}
        renderItem={({ item, index }) => {
          const missed = isMissed(item);
          const duration = item.answered_at && item.ended_at ? formatDuration((new Date(item.ended_at).getTime() - new Date(item.answered_at).getTime()) / 1000) : null;
          const statusText =
            item.status === 'busy' ? t('calls.statusBusy') : item.status === 'declined' ? t('calls.statusDeclined') : missed ? t('calls.statusMissed') : item.status === 'cancelled' || item.status === 'missed' ? t('calls.statusNoAnswer') : duration ?? t('calls.statusActive');
          return (
            <Animated.View entering={entering(index * 25)} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10 }}>
              <Avatar name={item.peer_display_name} seed={item.peer_id} size={50} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={{ color: missed ? c.danger : c.text, fontSize: 16, fontWeight: '700' }} numberOfLines={1}>
                  {item.peer_display_name}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 }}>
                  <Ionicons name={item.outgoing ? 'arrow-up-outline' : 'arrow-down-outline'} size={14} color={missed ? c.danger : item.outgoing ? c.primary : c.success} style={{ transform: [{ rotate: '45deg' }] }} />
                  <Ionicons name={item.video ? 'videocam' : 'call'} size={13} color={c.textMuted} />
                  <Text style={{ color: c.textMuted, fontSize: 13 }} numberOfLines={1}>
                    {statusText} · {chatTime(item.created_at)}
                  </Text>
                </View>
              </View>
              <Pressable onPress={() => redial(item, false)} hitSlop={6} accessibilityLabel={t('calls.audioCall')} style={{ padding: 8 }}>
                <Ionicons name="call-outline" size={22} color={c.primary} />
              </Pressable>
              <Pressable onPress={() => redial(item, true)} hitSlop={6} accessibilityLabel={t('calls.videoCall')} style={{ padding: 8 }}>
                <Ionicons name="videocam-outline" size={24} color={c.primary} />
              </Pressable>
            </Animated.View>
          );
        }}
      />
    </View>
  );
}
