import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, ScrollView, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useColors } from '@/contexts/ThemeContext';
import { Button, Field, Header } from '@/components/ui';
import { sb } from '@/lib/supabase';
import { humanError } from '@/utils/errors';

export default function ChangePasswordScreen() {
  const c = useColors();
  const router = useRouter();
  const { session, passwordRecovery, finishPasswordRecovery } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [next2, setNext2] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    if (!passwordRecovery && !current) return setError('Введите текущий пароль.');
    if (next.length < 8) return setError('Новый пароль: минимум 8 символов.');
    if (next !== next2) return setError('Пароли не совпадают.');
    setBusy(true);
    try {
      if (!passwordRecovery) {
        const { error: authError } = await sb().auth.signInWithPassword({ email: session!.user.email!, password: current });
        if (authError) throw new Error('Текущий пароль неверный.');
      }
      const { error: updError } = await sb().auth.updateUser({ password: next });
      if (updError) throw updError;
      finishPasswordRecovery();
      Alert.alert('Готово', 'Пароль изменён.');
      router.back();
    } catch (e) {
      setError(e instanceof Error && e.message.startsWith('Текущий') ? e.message : humanError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: c.background }}>
      <Header title={passwordRecovery ? 'Новый пароль' : 'Смена пароля'} back />
      <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
        {!passwordRecovery ? <Field label="Текущий пароль" icon="lock-open" value={current} onChangeText={setCurrent} secureTextEntry /> : null}
        <Field label="Новый пароль" icon="lock-closed" value={next} onChangeText={setNext} secureTextEntry autoComplete="new-password" />
        <Field label="Повторите новый пароль" icon="lock-closed" value={next2} onChangeText={setNext2} secureTextEntry />
        {error ? <Text style={{ color: c.danger, marginBottom: 12 }}>{error}</Text> : null}
        <Button title="Сохранить пароль" onPress={submit} loading={busy} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
