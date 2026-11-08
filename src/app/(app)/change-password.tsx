import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, ScrollView, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useColors } from '@/contexts/ThemeContext';
import { Button, Field, Header } from '@/components/ui';
import { sb } from '@/lib/supabase';
import { humanError } from '@/utils/errors';
import { useT } from '@/i18n';

class WrongCurrentPassword extends Error {}

export default function ChangePasswordScreen() {
  const c = useColors();
  const t = useT();
  const router = useRouter();
  const { session, passwordRecovery, finishPasswordRecovery } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [next2, setNext2] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    if (!passwordRecovery && !current) return setError(t('password.enterCurrent'));
    if (next.length < 8) return setError(t('auth.passwordRule'));
    if (next !== next2) return setError(t('auth.passwordsDiffer'));
    setBusy(true);
    try {
      if (!passwordRecovery) {
        const { error: authError } = await sb().auth.signInWithPassword({ email: session!.user.email!, password: current });
        if (authError) throw new WrongCurrentPassword();
      }
      const { error: updError } = await sb().auth.updateUser({ password: next });
      if (updError) throw updError;
      finishPasswordRecovery();
      Alert.alert(t('common.done'), t('password.changed'));
      router.back();
    } catch (e) {
      setError(e instanceof WrongCurrentPassword ? t('password.wrongCurrent') : humanError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: c.background }}>
      <Header title={passwordRecovery ? t('password.newTitle') : t('security.changePassword')} back />
      <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
        {!passwordRecovery ? <Field label={t('password.current')} icon="lock-open" value={current} onChangeText={setCurrent} secureTextEntry /> : null}
        <Field label={t('password.new')} icon="lock-closed" value={next} onChangeText={setNext} secureTextEntry autoComplete="new-password" />
        <Field label={t('password.repeat')} icon="lock-closed" value={next2} onChangeText={setNext2} secureTextEntry />
        {error ? <Text style={{ color: c.danger, marginBottom: 12 }}>{error}</Text> : null}
        <Button title={t('password.save')} onPress={submit} loading={busy} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
