import React, { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { useColors } from '@/contexts/ThemeContext';
import { AuthShell } from '@/components/AuthShell';
import { Button, Field } from '@/components/ui';
import { humanError } from '@/utils/errors';
import { EMAIL_RE } from '@/utils/format';
import { hasBuildTimeConfig } from '@/lib/supabase';
import { useT } from '@/i18n';

export default function SignInScreen() {
  const c = useColors();
  const t = useT();
  const { signIn, resetServer } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    if (!EMAIL_RE.test(email.trim())) return setError(t('auth.invalidEmail'));
    if (!password) return setError(t('auth.enterPassword'));
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
    <AuthShell title={t('auth.signInTitle')} subtitle={t('auth.signInSubtitle')}>
      <Field label={t('auth.email')} icon="mail" value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" placeholder="you@example.com" />
      <Field
        label={t('auth.password')}
        icon="lock-closed"
        value={password}
        onChangeText={setPassword}
        secureTextEntry={!showPassword}
        autoComplete="password"
        placeholder="••••••••"
        onSubmitEditing={submit}
        right={
          <Pressable onPress={() => setShowPassword((v) => !v)} hitSlop={10} accessibilityLabel={t('auth.togglePassword')}>
            <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color={c.textMuted} />
          </Pressable>
        }
      />
      {error ? <Text style={{ color: c.danger, marginBottom: 12 }}>{error}</Text> : null}
      <Button title={t('auth.signIn')} onPress={submit} loading={busy} />
      <Link href="/forgot-password" asChild>
        <Pressable style={{ alignSelf: 'center', padding: 14 }}>
          <Text style={{ color: c.primary, fontWeight: '600' }}>{t('auth.forgot')}</Text>
        </Pressable>
      </Link>
      <View style={{ flex: 1 }} />
      <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 24 }}>
        <Text style={{ color: c.textMuted }}>{t('auth.noAccount')} </Text>
        <Link href="/sign-up" asChild>
          <Pressable>
            <Text style={{ color: c.primary, fontWeight: '700' }}>{t('auth.signUp')}</Text>
          </Pressable>
        </Link>
      </View>
      {!hasBuildTimeConfig() ? (
        <Pressable
          style={{ alignSelf: 'center', padding: 12, marginTop: 8 }}
          onPress={() =>
            Alert.alert(t('auth.changeServerTitle'), t('auth.changeServerText'), [
              { text: t('common.cancel'), style: 'cancel' },
              { text: t('auth.changeServer'), onPress: () => resetServer() },
            ])
          }
        >
          <Text style={{ color: c.textMuted, fontSize: 13 }}>{t('auth.changeServer')}</Text>
        </Pressable>
      ) : null}
    </AuthShell>
  );
}
