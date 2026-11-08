import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { useAuth } from '@/contexts/AuthContext';
import { ThemeMode, useColors, useTheme } from '@/contexts/ThemeContext';
import { Avatar, Header, Row, Section } from '@/components/ui';
import { fingerprint } from '@/crypto/box';
import { humanError } from '@/utils/errors';
import { radius } from '@/constants/theme';

const themeOptions: { mode: ThemeMode; label: string }[] = [
  { mode: 'dark', label: 'Тёмная' },
  { mode: 'light', label: 'Светлая' },
  { mode: 'system', label: 'Как в системе' },
];

export default function SettingsScreen() {
  const c = useColors();
  const router = useRouter();
  const { mode, setMode } = useTheme();
  const { profile, keys, signOut, deleteAccount } = useAuth();
  const [busy, setBusy] = useState(false);

  const confirmSignOut = () =>
    Alert.alert('Выйти из аккаунта?', 'Ключ шифрования останется на этом устройстве, и после входа старые сообщения будут доступны.', [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Выйти', style: 'destructive', onPress: () => signOut().catch((e) => Alert.alert('Ошибка', humanError(e))) },
    ]);

  const confirmDelete = () =>
    Alert.alert('Удалить аккаунт?', 'Профиль, все ваши переписки и сообщения будут удалены с сервера навсегда. Это нельзя отменить.', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить навсегда',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await deleteAccount();
          } catch (e) {
            Alert.alert('Ошибка', humanError(e));
          } finally {
            setBusy(false);
          }
        },
      },
    ]);

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <Header title="Настройки" />
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <Pressable onPress={() => router.push('/profile')} style={{ marginHorizontal: 16, marginBottom: 22, padding: 16, borderRadius: radius.lg, backgroundColor: c.surface, flexDirection: 'row', alignItems: 'center' }}>
          <Avatar name={profile?.display_name ?? '?'} seed={profile?.id ?? 'me'} size={62} />
          <View style={{ marginLeft: 14, flex: 1 }}>
            <Text style={{ color: c.text, fontSize: 19, fontWeight: '700' }} numberOfLines={1}>
              {profile?.display_name ?? '…'}
            </Text>
            <Text style={{ color: c.textMuted, marginTop: 2 }}>@{profile?.username ?? '…'}</Text>
            <Text style={{ color: c.primary, marginTop: 6, fontSize: 13, fontWeight: '600' }}>Изменить профиль</Text>
          </View>
        </Pressable>

        <Section title="Оформление">
          <View style={{ flexDirection: 'row', padding: 6, gap: 6 }}>
            {themeOptions.map((o) => (
              <Pressable
                key={o.mode}
                onPress={() => setMode(o.mode)}
                style={{ flex: 1, paddingVertical: 10, borderRadius: radius.sm, alignItems: 'center', backgroundColor: mode === o.mode ? c.primary : 'transparent' }}
              >
                <Text style={{ color: mode === o.mode ? '#fff' : c.text, fontWeight: '600', fontSize: 13 }}>{o.label}</Text>
              </Pressable>
            ))}
          </View>
        </Section>

        <Section
          title="Конфиденциальность и безопасность"
          footer="Сообщения шифруются на устройстве (X25519 + XSalsa20-Poly1305, библиотека TweetNaCl), сервер хранит только шифротекст. Ограничения: нет прямой секретности (forward secrecy), ключ один на устройство. Сравните код безопасности с собеседником при встрече, чтобы исключить подмену ключа."
        >
          <Row icon="key" label="Мой код безопасности" value={keys ? fingerprint(keys.publicKey).slice(0, 11) + '…' : '…'} onPress={() => router.push('/security')} />
          <Row icon="lock-closed" label="Изменить пароль" onPress={() => router.push('/change-password')} />
          <Row icon="ban" label="Заблокированные" onPress={() => router.push('/blocked')} last />
        </Section>

        <Section title="Уведомления" footer="Push-уведомления ещё не подключены: для Android нужен проект Firebase (google-services.json), для сервера — функция отправки. Пока новые сообщения видны, только когда приложение открыто.">
          <Row icon="notifications-off" label="Push-уведомления" value="Не настроены" last />
        </Section>

        <Section title="Язык">
          <Row icon="language" label="Язык интерфейса" value="Русский" last />
        </Section>

        <Section title="О приложении">
          <Row icon="information-circle" label="Версия" value={Constants.expoConfig?.version ?? '1.0.0'} last />
        </Section>

        <Section>
          <Row icon="log-out" label="Выйти" onPress={confirmSignOut} danger />
          <Row icon="trash" label={busy ? 'Удаление…' : 'Удалить аккаунт'} onPress={busy ? undefined : confirmDelete} danger last />
        </Section>
      </ScrollView>
    </View>
  );
}
