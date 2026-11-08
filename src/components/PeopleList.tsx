import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { useColors } from '@/contexts/ThemeContext';
import { Avatar, EmptyState, ErrorBanner, useEntering } from '@/components/ui';
import { getPresence, searchUsers } from '@/services/users';
import { humanError } from '@/utils/errors';
import { Presence, presenceLabel } from '@/utils/format';
import { useT } from '@/i18n';
import Animated from 'react-native-reanimated';
import type { Profile } from '@/types';

export function usePresence(ids: string[]) {
  const [presence, setPresence] = useState<Record<string, Presence>>({});
  const key = ids.join(',');
  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    const load = () => getPresence(key.split(',')).then((p) => !cancelled && setPresence(p)).catch(() => {});
    load();
    const timer = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [key]);
  return presence;
}

// Debounced username search; returns null while the query is too short.
export function useUserSearch(query: string, myId: string) {
  const [results, setResults] = useState<Profile[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const q = query.trim().replace(/^@/, '');
    if (q.length < 2) {
      setResults(null);
      setSearching(false);
      return;
    }
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        setResults(await searchUsers(q, myId));
        setError(null);
      } catch (e) {
        setError(humanError(e));
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query, myId]);
  return { results, searching, error };
}

export function PeopleList({
  people,
  loading,
  error,
  empty,
  header,
  onPress,
  bottomSpace = 24,
}: {
  people: Profile[];
  loading?: boolean;
  error?: string | null;
  empty: React.ReactElement;
  header?: React.ReactElement | null;
  onPress: (p: Profile) => void;
  bottomSpace?: number;
}) {
  const c = useColors();
  const t = useT();
  const entering = useEntering();
  const presence = usePresence(people.map((p) => p.id));
  return (
    <>
      {error ? <ErrorBanner message={error} /> : null}
      <FlatList
        data={people}
        keyExtractor={(p) => p.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ flexGrow: 1, paddingBottom: bottomSpace }}
        ListHeaderComponent={header ?? undefined}
        ListEmptyComponent={loading ? <ActivityIndicator color={c.primary} style={{ marginTop: 32 }} /> : empty}
        renderItem={({ item, index }) => (
          <Animated.View entering={entering(index * 25)}>
            <Pressable
              onPress={() => onPress(item)}
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: pressed ? c.surface : 'transparent' })}
            >
              <Avatar name={item.display_name} seed={item.id} size={50} online={presence[item.id]?.is_online} />
              <View style={{ marginLeft: 12, flex: 1 }}>
                <Text style={{ color: c.text, fontSize: 16, fontWeight: '600' }} numberOfLines={1}>
                  {item.display_name}
                </Text>
                <Text style={{ color: c.textMuted, fontSize: 13, marginTop: 2 }} numberOfLines={1}>
                  @{item.username} · {presence[item.id] ? presenceLabel(presence[item.id]) : t('presence.recently')}
                </Text>
              </View>
            </Pressable>
          </Animated.View>
        )}
      />
    </>
  );
}

export function SearchEmpty() {
  const t = useT();
  return <EmptyState icon="person-remove" title={t('contacts.notFoundTitle')} text={t('contacts.notFoundText')} />;
}
