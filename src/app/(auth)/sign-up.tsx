import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { useColors } from '@/contexts/ThemeContext';
import { AuthShell } from '@/components/AuthShell';
import { Button, EmptyState, Field } from '@/components/ui';
import { humanError } from '@/utils/errors';
import { EMAIL_RE, USERNAME_RE } from '@/utils/format';

export default function SignUpScreen() {
  const c = useColors();
  const router = useRouter();
  const { signUp } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const submit = async () => {
    const e: Record<string, string> = {};
    if (!displayName.trim()) e.displayName = 'Введите имя.';
    if (!USERNAME_RE.test(username)) e.username = '3–24 символа: латиница, цифры, _';
    if (!EMAIL_RE.test(email.trim())) e.email = 'Некорректный email.';
    if (password.length < 8) e.password = 'Минимум 8 символов.';
    if (password !== password2) e.password2 = 'Пароли не совпадают.';
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
        <EmptyState icon="mail-unread" title="Подтвердите email" text={`Мы отправили письмо на ${sentTo}. Откройте ссылку из письма на этом телефоне, затем войдите.`}>
          <Button title="Ко входу" onPress={() => router.replace('/')} />
        </EmptyState>
      </View>
    );
  }

  return (
    <AuthShell title="Создать аккаунт" subtitle="Ваш email никто из пользователей не увидит.">
      <Field label="Имя" icon="person" value={displayName} onChangeText={setDisplayName} maxLength={64} error={errors.displayName} placeholder="Иван Петров" />
      <Field
        label="Username"
        icon="at"
        value={username}
        onChangeText={(t) => setUsername(t.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
        autoCapitalize="none"
        maxLength={24}
        error={errors.username}
        placeholder="ivan_petrov"
      />
      <Field label="Email" icon="mail" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" error={errors.email} placeholder="you@example.com" />
      <Field label="Пароль" icon="lock-closed" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" error={errors.password} placeholder="Минимум 8 символов" />
      <Field label="Повторите пароль" icon="lock-closed" value={password2} onChangeText={setPassword2} secureTextEntry error={errors.password2} placeholder="••••••••" />
      {errors.form ? <Text style={{ color: c.danger, marginBottom: 12 }}>{errors.form}</Text> : null}
      <Button title="Зарегистрироваться" onPress={submit} loading={busy} />
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 18, alignItems: 'flex-start' }}>
        <Ionicons name="key" size={16} color={c.textMuted} style={{ marginTop: 2 }} />
        <Text style={{ color: c.textMuted, fontSize: 12, flex: 1, lineHeight: 17 }}>
          Ключ шифрования создаётся на этом устройстве и не покидает его. Если удалить приложение или войти с другого телефона, прочитать старые сообщения будет невозможно.
        </Text>
      </View>
      <Pressable onPress={() => router.back()} style={{ alignSelf: 'center', padding: 16 }}>
        <Text style={{ color: c.primary, fontWeight: '600' }}>Уже есть аккаунт? Войти</Text>
      </Pressable>
    </AuthShell>
  );
}
