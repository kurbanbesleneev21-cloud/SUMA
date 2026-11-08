import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useColors } from '@/contexts/ThemeContext';
import { AuthShell } from '@/components/AuthShell';
import { Button, EmptyState, Field } from '@/components/ui';
import { humanError } from '@/utils/errors';
import { EMAIL_RE } from '@/utils/format';

export default function ForgotPasswordScreen() {
  const c = useColors();
  const router = useRouter();
  const { sendPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async () => {
    setError(null);
    if (!EMAIL_RE.test(email.trim())) return setError('Введите корректный email.');
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
        <EmptyState icon="mail-open" title="Проверьте почту" text="Если такой аккаунт существует, мы отправили ссылку для сброса пароля. Откройте её на этом телефоне — приложение предложит задать новый пароль.">
          <Button title="Ко входу" onPress={() => router.back()} />
        </EmptyState>
      </View>
    );
  }

  return (
    <AuthShell title="Сброс пароля" subtitle="Укажите email, на который зарегистрирован аккаунт.">
      <Field label="Email" icon="mail" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="you@example.com" onSubmitEditing={submit} />
      {error ? <Text style={{ color: c.danger, marginBottom: 12 }}>{error}</Text> : null}
      <Button title="Отправить ссылку" onPress={submit} loading={busy} />
      <Pressable onPress={() => router.back()} style={{ alignSelf: 'center', padding: 16 }}>
        <Text style={{ color: c.primary, fontWeight: '600' }}>Назад</Text>
      </Pressable>
    </AuthShell>
  );
}
