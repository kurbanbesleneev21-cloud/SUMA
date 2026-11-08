import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { useColors } from '@/contexts/ThemeContext';
import { AuthShell } from '@/components/AuthShell';
import { Button, EmptyState, Field, tap } from '@/components/ui';
import { humanError } from '@/utils/errors';
import { EMAIL_RE, USERNAME_RE } from '@/utils/format';
import { useT } from '@/i18n';

export default function SignUpScreen() {
  const c = useColors();
  const t = useT();
  const router = useRouter();
  const { signUp } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const submit = async () => {
    const e: Record<string, string> = {};
    if (!displayName.trim()) e.displayName = t('auth.enterName');
    if (!USERNAME_RE.test(username)) e.username = t('auth.usernameRule');
    if (!EMAIL_RE.test(email.trim())) e.email = t('auth.invalidEmail');
    if (password.length < 8) e.password = t('auth.passwordRule');
    if (password !== password2) e.password2 = t('auth.passwordsDiffer');
    if (!accepted) e.accept = t('auth.mustAccept');
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      const { needsConfirmation } = await signUp({ email, password, username, displayName });
      if (needsConfirmation) setSentTo(email.trim());
    } catch (err) {
      setErrors({ form: humanError(err) });
    } finally {
      setBusy(false);
    }
  };

  if (sentTo) {
    return (
      <View style={{ flex: 1, backgroundColor: c.background }}>
        <EmptyState icon="mail-unread" title={t('auth.confirmTitle')} text={t('auth.confirmText', { email: sentTo })}>
          <Button title={t('auth.toSignIn')} onPress={() => router.replace('/')} />
        </EmptyState>
      </View>
    );
  }

  return (
    <AuthShell title={t('auth.signUpTitle')} subtitle={t('auth.signUpSubtitle')}>
      <Field label={t('auth.name')} icon="person" value={displayName} onChangeText={setDisplayName} maxLength={64} error={errors.displayName} />
      <Field label={t('auth.username')} icon="at" value={username} onChangeText={(v) => setUsername(v.toLowerCase().replace(/[^a-z0-9_]/g, ''))} autoCapitalize="none" maxLength={24} error={errors.username} placeholder="ivan_petrov" />
      <Field label={t('auth.email')} icon="mail" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" error={errors.email} placeholder="you@example.com" />
      <Field label={t('auth.password')} icon="lock-closed" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" error={errors.password} placeholder={t('auth.passwordRule')} />
      <Field label={t('auth.repeatPassword')} icon="lock-closed" value={password2} onChangeText={setPassword2} secureTextEntry error={errors.password2} placeholder="••••••••" />

      <Pressable
        onPress={() => {
          tap();
          setAccepted((v) => !v);
        }}
        style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 6 }}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: accepted }}
      >
        <Ionicons name={accepted ? 'checkbox' : 'square-outline'} size={24} color={errors.accept && !accepted ? c.danger : c.primary} />
        <Text style={{ color: c.textMuted, flex: 1, lineHeight: 20 }}>
          {t('auth.acceptPrefix')}{' '}
          <Text style={{ color: c.primary, fontWeight: '600' }} onPress={() => router.push({ pathname: '/legal/[doc]', params: { doc: 'privacy' } })}>
            {t('auth.privacyLink')}
          </Text>{' '}
          {t('auth.and')}{' '}
          <Text style={{ color: c.primary, fontWeight: '600' }} onPress={() => router.push({ pathname: '/legal/[doc]', params: { doc: 'terms' } })}>
            {t('auth.termsLink')}
          </Text>
        </Text>
      </Pressable>
      {errors.accept ? <Text style={{ color: c.danger, fontSize: 12, marginLeft: 34, marginBottom: 8 }}>{errors.accept}</Text> : null}

      {errors.form ? <Text style={{ color: c.danger, marginVertical: 12 }}>{errors.form}</Text> : null}
      <Button title={t('auth.signUp')} onPress={submit} loading={busy} style={{ marginTop: 14 }} />
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 18, alignItems: 'flex-start' }}>
        <Ionicons name="key" size={16} color={c.textMuted} style={{ marginTop: 2 }} />
        <Text style={{ color: c.textMuted, fontSize: 12, flex: 1, lineHeight: 17 }}>{t('auth.keyNotice')}</Text>
      </View>
      <Pressable onPress={() => router.back()} style={{ alignSelf: 'center', padding: 16 }}>
        <Text style={{ color: c.primary, fontWeight: '600' }}>{t('auth.haveAccount')}</Text>
      </Pressable>
    </AuthShell>
  );
}
