import React, { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useColors } from '@/contexts/ThemeContext';
import { AuthShell } from '@/components/AuthShell';
import { Button, Field } from '@/components/ui';
import { humanError } from '@/utils/errors';
import { EMAIL_RE } from '@/utils/format';
import { hasBuildTimeConfig } from '@/lib/supabase';

export default function SignInScreen() {
  const c = useColors();
  const { signIn, resetServer } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    if (!EMAIL_RE.test(email.trim())) return setError('Введите корректный email.');
    if (!password) return setError('Введите пароль.');
    setBusy(true);
    try {
      await signIn(email, password);
    } catch (e) {
      setError(humanError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title="С возвращением" subtitle="Войдите, чтобы продолжить общение.">
      <Field label="Email" icon="mail" value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" placeholder="you@example.com" />
      <Field label="Пароль" icon="lock-closed" value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" placeholder="••••••••" onSubmitEditing={submit} />
      {error ? <Text style={{ color: c.danger, marginBottom: 12 }}>{error}</Text> : null}
      <Button title="Войти" onPress={submit} loading={busy} />
      <Link href="/forgot-password" asChild>
        <Pressable style={{ alignSelf: 'center', padding: 14 }}>
          <Text style={{ color: c.primary, fontWeight: '600' }}>Забыли пароль?</Text>
        </Pressable>
      </Link>
      <View style={{ flex: 1 }} />
      <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 24 }}>
        <Text style={{ color: c.textMuted }}>Нет аккаунта? </Text>
        <Link href="/sign-up" asChild>
          <Pressable>
            <Text style={{ color: c.primary, fontWeight: '700' }}>Зарегистрироваться</Text>
          </Pressable>
        </Link>
      </View>
      {!hasBuildTimeConfig() ? (
        <Pressable
          style={{ alignSelf: 'center', padding: 12, marginTop: 8 }}
          onPress={() =>
            Alert.alert('Сменить сервер?', 'Вы вернётесь к экрану подключения.', [
              { text: 'Отмена', style: 'cancel' },
              { text: 'Сменить', onPress: () => resetServer() },
            ])
          }
        >
          <Text style={{ color: c.textMuted, fontSize: 13 }}>Сменить сервер</Text>
        </Pressable>
      ) : null}
    </AuthShell>
  );
}
