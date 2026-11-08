import React, { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useColors } from '@/contexts/ThemeContext';
import { Avatar, Button, ErrorBanner, Header, Loading, Row, Section, useEntering } from '@/components/ui';
import { usePresence } from '@/components/PeopleList';
import { addContact, blockUser, getProfile, isBlockedByMe, isContact, removeContact, unblockUser } from '@/services/users';
import { openDirectChat } from '@/services/chats';
import { fingerprint } from '@/crypto/box';
import { humanError } from '@/utils/errors';
import { fullDate, presenceLabel } from '@/utils/format';
import { useT } from '@/i18n';
import type { Profile } from '@/types';

export default function UserScreen() {
  const c = useColors();
  const t = useT();
  const router = useRouter();
  const entering = useEntering();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const myId = session!.user.id;
  const [user, setUser] = useState<Profile | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [contact, setContact] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const presence = usePresence(user ? [user.id] : [])[user?.id ?? ''];

  const load = useCallback(async () => {
    try {
      const [p, b, ct] = await Promise.all([getProfile(id), isBlockedByMe(myId, id), isContact(myId, id)]);
      setUser(p);
      setBlocked(b);
      setContact(ct);
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
      Alert.alert(t('user.cannotOpenChat'), humanError(e));
    } finally {
      setBusy(false);
    }
  };

  const toggleContact = async () => {
    try {
      if (contact) await removeContact(myId, id);
      else await addContact(myId, id);
      setContact(!contact);
    } catch (e) {
      Alert.alert(t('common.error'), humanError(e));
    }
  };

  const toggleBlock = () => {
    if (blocked) {
      unblockUser(myId, id).then(() => setBlocked(false)).catch((e) => Alert.alert(t('common.error'), humanError(e)));
      return;
    }
    Alert.alert(t('user.blockTitle'), t('user.blockText'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('user.block'), style: 'destructive', onPress: () => blockUser(myId, id).then(() => setBlocked(true)).catch((e) => Alert.alert(t('common.error'), humanError(e))) },
    ]);
  };

  const isMe = id === myId;

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <LinearGradient colors={[c.navy, c.background]} style={[StyleSheet.absoluteFill, { height: 320 }]} />
      <Header back />
      {error ? <ErrorBanner message={error} onRetry={load} /> : null}
      {user ? (
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
          <Animated.View entering={entering()} style={{ alignItems: 'center', paddingHorizontal: 24, marginBottom: 24 }}>
            <Avatar name={user.display_name} seed={user.id} size={112} online={presence?.is_online} />
            <Text style={{ color: c.text, fontSize: 26, fontWeight: '800', marginTop: 14, textAlign: 'center' }}>{user.display_name}</Text>
            <Text style={{ color: presence?.is_online ? c.primary : c.textMuted, marginTop: 4 }}>
              @{user.username} · {presenceLabel(presence)}
            </Text>
            {user.bio ? <Text style={{ color: c.text, marginTop: 14, textAlign: 'center', lineHeight: 20 }}>{user.bio}</Text> : null}
          </Animated.View>
          {!isMe ? (
            <Animated.View entering={entering(60)} style={{ paddingHorizontal: 16, marginBottom: 24, gap: 10 }}>
              {user.public_key ? (
                <Button title={t('user.write')} icon="chatbubble" onPress={write} loading={busy} disabled={blocked} />
              ) : (
                <Text style={{ color: c.textMuted, textAlign: 'center' }}>{t('user.noKey')}</Text>
              )}
              <Button title={contact ? t('user.removeContact') : t('user.addContact')} icon={contact ? 'person-remove' : 'person-add'} variant="secondary" onPress={toggleContact} />
            </Animated.View>
          ) : null}
          <Animated.View entering={entering(120)}>
            <Section footer={t('user.safetyFooter')}>
              <Row icon="calendar" label={t('user.joined')} value={fullDate(user.created_at)} />
              <Row
                icon="key"
                label={t('user.safetyCode')}
                value={user.public_key ? fingerprint(user.public_key).slice(0, 11) + '…' : t('user.noKeyShort')}
                onPress={user.public_key ? () => Alert.alert(t('user.safetyCodeOf', { name: user.display_name }), fingerprint(user.public_key!)) : undefined}
                last
              />
            </Section>
            {!isMe ? (
              <Section>
                <Row icon={blocked ? 'checkmark-circle' : 'ban'} label={blocked ? t('user.unblock') : t('user.block')} onPress={toggleBlock} danger={!blocked} last />
              </Section>
            ) : null}
          </Animated.View>
        </ScrollView>
      ) : null}
    </View>
  );
}
