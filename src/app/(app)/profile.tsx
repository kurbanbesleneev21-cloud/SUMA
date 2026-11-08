import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useColors } from '@/contexts/ThemeContext';
import { Avatar, Button, Field, Header } from '@/components/ui';
import { humanError } from '@/utils/errors';
import { USERNAME_RE } from '@/utils/format';

export default function ProfileScreen() {
  const c = useColors();
  const router = useRouter();
  const { profile, updateProfile } = useAuth();
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  const [username, setUsername] = useState(profile?.username ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const e: Record<string, string> = {};
    if (!displayName.trim()) e.displayName = 'Имя не может быть пустым.';
    if (!USERNAME_RE.test(username)) e.username = '3–24 символа: латиница, цифры, _';
    if (bio.length > 300) e.bio = 'Не больше 300 символов.';
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      await updateProfile({ display_name: displayName.trim(), username, bio: bio.trim() });
      router.back();
    } catch (err) {
      Alert.alert('Не удалось сохранить', humanError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: c.background }}>
      <Header title="Профиль" back />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <View style={{ alignItems: 'center', marginBottom: 24 }}>
          <Avatar name={displayName || '?'} seed={profile?.id ?? 'me'} size={104} />
          <Text style={{ color: c.textMuted, fontSize: 12, marginTop: 10, textAlign: 'center' }}>
            Загрузка фото аватара появится вместе с зашифрованными вложениями.
          </Text>
        </View>
        <Field label="Имя" icon="person" value={displayName} onChangeText={setDisplayName} maxLength={64} error={errors.displayName} />
        <Field label="Username" icon="at" value={username} onChangeText={(t) => setUsername(t.toLowerCase().replace(/[^a-z0-9_]/g, ''))} autoCapitalize="none" maxLength={24} error={errors.username} />
        <Field label="О себе" icon="document-text" value={bio} onChangeText={setBio} multiline maxLength={300} error={errors.bio} placeholder="Пара слов о себе" style={{ minHeight: 80, textAlignVertical: 'top' }} />
        <Text style={{ color: c.textMuted, fontSize: 12, marginBottom: 16, marginLeft: 4 }}>
          На сервисе с {profile ? new Date(profile.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }) : '…'}
        </Text>
        <Button title="Сохранить" onPress={save} loading={busy} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
