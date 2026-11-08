import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useColors } from '@/contexts/ThemeContext';
import { Avatar, Button, Field, Header } from '@/components/ui';
import { humanError } from '@/utils/errors';
import { fullDate, USERNAME_RE } from '@/utils/format';
import { useT } from '@/i18n';

export default function ProfileScreen() {
  const c = useColors();
  const t = useT();
  const router = useRouter();
  const { profile, updateProfile } = useAuth();
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  const [username, setUsername] = useState(profile?.username ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const e: Record<string, string> = {};
    if (!displayName.trim()) e.displayName = t('auth.enterName');
    if (!USERNAME_RE.test(username)) e.username = t('auth.usernameRule');
    if (bio.length > 300) e.bio = t('profile.bioTooLong');
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      await updateProfile({ display_name: displayName.trim(), username, bio: bio.trim() });
      router.back();
    } catch (err) {
      Alert.alert(t('profile.saveFailed'), humanError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: c.background }}>
      <Header title={t('profile.title')} back />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <View style={{ alignItems: 'center', marginBottom: 24 }}>
          <Avatar name={displayName || '?'} seed={profile?.id ?? 'me'} size={108} />
          <Text style={{ color: c.textMuted, fontSize: 12, marginTop: 10, textAlign: 'center' }}>{t('profile.photoLater')}</Text>
        </View>
        <Field label={t('auth.name')} icon="person" value={displayName} onChangeText={setDisplayName} maxLength={64} error={errors.displayName} />
        <Field label={t('auth.username')} icon="at" value={username} onChangeText={(v) => setUsername(v.toLowerCase().replace(/[^a-z0-9_]/g, ''))} autoCapitalize="none" maxLength={24} error={errors.username} />
        <Field label={t('profile.bio')} icon="document-text" value={bio} onChangeText={setBio} multiline maxLength={300} error={errors.bio} placeholder={t('profile.bioPlaceholder')} style={{ minHeight: 80, textAlignVertical: 'top' }} />
        <Text style={{ color: c.textMuted, fontSize: 12, marginBottom: 16, marginLeft: 4 }}>{t('profile.since', { date: profile ? fullDate(profile.created_at) : '…' })}</Text>
        <Button title={t('common.save')} onPress={save} loading={busy} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
