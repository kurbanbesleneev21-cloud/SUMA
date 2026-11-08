import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useColors } from '@/contexts/ThemeContext';
import { AuthShell } from '@/components/AuthShell';
import { Button, EmptyState, Field } from '@/components/ui';
import { humanError } from '@/utils/errors';
import { EMAIL_RE } from '@/utils/format';
import { useT } from '@/i18n';

export default function ForgotPasswordScreen() {
  const c = useColors();
  const t = useT();
  const router = useRouter();
  const { sendPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async () => {
    setError(null);
    if (!EMAIL_RE.test(email.trim())) return setError(t('auth.invalidEmail'));
    setBusy(true);
    try {
      await sendPasswordReset(email);
      setSent(true);
    } catch (e) {
      setError(humanError(e));
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <View style={{ flex: 1, backgroundColor: c.background }}>
        <EmptyState icon="mail-open" title={t('auth.resetSentTitle')} text={t('auth.resetSentText')}>
          <Button title={t('auth.toSignIn')} onPress={() => router.back()} />
        </EmptyState>
      </View>
    );
  }

  return (
    <AuthShell title={t('auth.resetTitle')} subtitle={t('auth.resetSubtitle')}>
      <Field label={t('auth.email')} icon="mail" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="you@example.com" onSubmitEditing={submit} />
      {error ? <Text style={{ color: c.danger, marginBottom: 12 }}>{error}</Text> : null}
      <Button title={t('auth.sendLink')} onPress={submit} loading={busy} />
      <Pressable onPress={() => router.back()} style={{ alignSelf: 'center', padding: 16 }}>
        <Text style={{ color: c.primary, fontWeight: '600' }}>{t('common.back')}</Text>
      </Pressable>
    </AuthShell>
  );
}
