import React, { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useColors } from '@/contexts/ThemeContext';
import { Avatar, Button, ErrorBanner, Header, Loading, Row, Section } from '@/components/ui';
import { blockUser, getProfile, isBlockedByMe, unblockUser } from '@/services/users';
import { openDirectChat } from '@/services/chats';
import { fingerprint } from '@/crypto/box';
import { humanError } from '@/utils/errors';
import { isOnline, lastSeenLabel } from '@/utils/format';
import type { Profile } from '@/types';

export default function UserScreen() {
  const c = useColors();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const myId = session!.user.id;
  const [user, setUser] = useState<Profile | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [p, b] = await Promise.all([getProfile(id), isBlockedByMe(myId, id)]);
      setUser(p);
      setBlocked(b);
      setError(null);
    } catch (e) {
      setError(humanError(e));
    }
  }, [id, myId]);

  useEffect(() => {
    load();
  }, [load]);

  if (!user && !error) return <Loading />;

  const write = async () => {
    setBusy(true);
    try {
      const chatId = await openDirectChat(id);
      router.replace({ pathname: '/chat/[id]', params: { id: chatId } });
    } catch (e) {
      Alert.alert('Не удалось открыть чат', humanError(e));
    } finally {
      setBusy(false);
    }
  };

  const toggleBlock = () => {
    if (blocked) {
      unblockUser(myId, id).then(() => setBlocked(false)).catch((e) => Alert.alert('Ошибка', humanError(e)));
      return;
    }
    Alert.alert('Заблокировать?', 'Пользователь не сможет писать вам, а вы — ему.', [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Заблокировать', style: 'destructive', onPress: () => blockUser(myId, id).then(() => setBlocked(true)).catch((e) => Alert.alert('Ошибка', humanError(e))) },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <Header title="" back />
      {error ? <ErrorBanner message={error} onRetry={load} /> : null}
      {user ? (
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
          <View style={{ alignItems: 'center', paddingHorizontal: 24, marginBottom: 24 }}>
            <Avatar name={user.display_name} seed={user.id} size={108} online={isOnline(user.last_seen_at)} />
            <Text style={{ color: c.text, fontSize: 24, fontWeight: '800', marginTop: 14, textAlign: 'center' }}>{user.display_name}</Text>
            <Text style={{ color: c.textMuted, marginTop: 4 }}>
              @{user.username} · {lastSeenLabel(user.last_seen_at)}
            </Text>
            {user.bio ? <Text style={{ color: c.text, marginTop: 14, textAlign: 'center', lineHeight: 20 }}>{user.bio}</Text> : null}
          </View>
          {id !== myId ? (
            <View style={{ paddingHorizontal: 16, marginBottom: 24 }}>
              {user.public_key ? (
                <Button title="Написать" icon="chatbubble" onPress={write} loading={busy} disabled={blocked} />
              ) : (
                <Text style={{ color: c.textMuted, textAlign: 'center' }}>Пользователь ещё ни разу не входил в приложение — написать ему пока нельзя.</Text>
              )}
            </View>
          ) : null}
          <Section footer="Сравните этот код с тем, что собеседник видит у себя в «Настройки → Мой код безопасности». Совпадение означает, что сервер не подменил ключ.">
            <Row icon="calendar" label="В NEXO с" value={new Date(user.created_at).toLocaleDateString('ru-RU')} />
            <Row
              icon="key"
              label="Код безопасности"
              value={user.public_key ? fingerprint(user.public_key).slice(0, 11) + '…' : 'нет ключа'}
              onPress={user.public_key ? () => Alert.alert(`Код ${user.display_name}`, fingerprint(user.public_key!)) : undefined}
              last
            />
          </Section>
          {id !== myId ? (
            <Section>
              <Row icon={blocked ? 'checkmark-circle' : 'ban'} label={blocked ? 'Разблокировать' : 'Заблокировать'} onPress={toggleBlock} danger={!blocked} last />
            </Section>
          ) : null}
        </ScrollView>
      ) : null}
    </View>
  );
}
