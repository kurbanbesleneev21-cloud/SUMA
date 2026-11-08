import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useColors } from '@/contexts/ThemeContext';
import { Avatar, EmptyState, ErrorBanner, Field, Header } from '@/components/ui';
import { searchUsers } from '@/services/users';
import { fetchMyChats } from '@/services/chats';
import { humanError } from '@/utils/errors';
import { isOnline, lastSeenLabel } from '@/utils/format';

interface Person {
  id: string;
  username: string;
  display_name: string;
  last_seen_at: string | null;
}

export default function ContactsScreen() {
  const c = useColors();
  const router = useRouter();
  const { session } = useAuth();
  const myId = session!.user.id;
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Person[]>([]);
  const [recent, setRecent] = useState<Person[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      fetchMyChats()
        .then((list) =>
          setRecent(
            list
              .filter((ch) => !ch.is_group && ch.peer_id)
              .map((ch) => ({ id: ch.peer_id!, username: ch.peer_username ?? '', display_name: ch.peer_display_name ?? '', last_seen_at: ch.peer_last_seen_at })),
          ),
        )
        .catch(() => {});
    }, []),
  );

  useEffect(() => {
    const q = query.trim();
    if (q.replace(/^@/, '').length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        setResults(await searchUsers(q, myId));
        setError(null);
      } catch (e) {
        setError(humanError(e));
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [query, myId]);

  const showingSearch = query.trim().replace(/^@/, '').length >= 2;
  const data = showingSearch ? results : recent;

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <Header title="Контакты" />
      <View style={{ paddingHorizontal: 16 }}>
        <Field icon="at" placeholder="Поиск по username" value={query} onChangeText={setQuery} autoCapitalize="none" autoCorrect={false} />
      </View>
      {error ? <ErrorBanner message={error} /> : null}
      {!showingSearch && recent.length > 0 ? (
        <Text style={{ color: c.textMuted, fontSize: 13, fontWeight: '600', textTransform: 'uppercase', marginHorizontal: 20, marginBottom: 6 }}>Недавние</Text>
      ) : null}
      <FlatList
        data={data}
        keyExtractor={(p) => p.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ flexGrow: 1 }}
        ListEmptyComponent={
          searching ? (
            <ActivityIndicator color={c.primary} style={{ marginTop: 32 }} />
          ) : showingSearch ? (
            <EmptyState icon="person-remove" title="Никого не нашли" text="Проверьте username. Поиск ищет по началу имени пользователя." />
          ) : (
            <EmptyState icon="people" title="Найдите друзей" text="Введите username собеседника (минимум 2 символа), чтобы начать переписку." />
          )
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push({ pathname: '/user/[id]', params: { id: item.id } })}
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: pressed ? c.surface : 'transparent' })}
          >
            <Avatar name={item.display_name} seed={item.id} size={48} online={isOnline(item.last_seen_at)} />
            <View style={{ marginLeft: 12, flex: 1 }}>
              <Text style={{ color: c.text, fontSize: 16, fontWeight: '600' }} numberOfLines={1}>
                {item.display_name}
              </Text>
              <Text style={{ color: c.textMuted, fontSize: 13, marginTop: 2 }} numberOfLines={1}>
                @{item.username} · {lastSeenLabel(item.last_seen_at)}
              </Text>
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}
