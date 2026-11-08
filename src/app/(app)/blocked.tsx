import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useColors } from '@/contexts/ThemeContext';
import { Avatar, EmptyState, ErrorBanner, Header, Loading } from '@/components/ui';
import { listBlocked, unblockUser } from '@/services/users';
import { humanError } from '@/utils/errors';
import { useT } from '@/i18n';
import type { Profile } from '@/types';

export default function BlockedScreen() {
  const c = useColors();
  const t = useT();
  const { session } = useAuth();
  const [list, setList] = useState<Profile[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setList(await listBlocked());
      setError(null);
    } catch (e) {
      setError(humanError(e));
      setList([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (list === null) return <Loading />;

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <Header title={t('privacy.blocked')} back />
      {error ? <ErrorBanner message={error} onRetry={load} /> : null}
      <FlatList
        data={list}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ flexGrow: 1 }}
        ListEmptyComponent={<EmptyState icon="happy" title={t('blocked.emptyTitle')} text={t('blocked.emptyText')} />}
        renderItem={({ item }) => (
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10 }}>
            <Avatar name={item.display_name} seed={item.id} size={44} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={{ color: c.text, fontWeight: '600' }}>{item.display_name}</Text>
              <Text style={{ color: c.textMuted, fontSize: 13 }}>@{item.username}</Text>
            </View>
            <Pressable
              onPress={async () => {
                try {
                  await unblockUser(session!.user.id, item.id);
                  setList((l) => (l ?? []).filter((p) => p.id !== item.id));
                } catch (e) {
                  setError(humanError(e));
                }
              }}
              style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: c.surfaceAlt }}
            >
              <Text style={{ color: c.primary, fontWeight: '600' }}>{t('user.unblock')}</Text>
            </Pressable>
          </View>
        )}
      />
    </View>
  );
}
