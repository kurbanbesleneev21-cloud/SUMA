import React, { useState } from 'react';
import { KeyboardAvoidingView, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { useColors } from '@/contexts/ThemeContext';
import { Button, Field } from '@/components/ui';
import { radius } from '@/constants/theme';

export default function SetupScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { configure } = useAuth();
  const [url, setUrl] = useState('');
  const [key, setKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    if (!url.trim() || !key.trim()) {
      setError('Заполните оба поля.');
      return;
    }
    setBusy(true);
    try {
      await configure(url, key);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось подключиться.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: c.background }}>
      <ScrollView contentContainerStyle={{ padding: 24, paddingTop: insets.top + 40 }} keyboardShouldPersistTaps="handled">
        <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
          <Ionicons name="server" size={30} color="#fff" />
        </View>
        <Text style={{ color: c.text, fontSize: 28, fontWeight: '800' }}>Подключение к серверу</Text>
        <Text style={{ color: c.textMuted, fontSize: 15, marginTop: 8, lineHeight: 21 }}>
          NEXO работает через ваш собственный проект Supabase. Укажите его адрес и публичный ключ (anon / publishable) из раздела Project Settings → API.
        </Text>

        <View style={{ marginTop: 28 }}>
          <Field label="Project URL" icon="link" placeholder="https://xxxx.supabase.co" value={url} onChangeText={setUrl} autoCapitalize="none" autoCorrect={false} keyboardType="url" />
          <Field label="Публичный ключ (anon)" icon="key" placeholder="eyJhbGciOi... или sb_publishable_..." value={key} onChangeText={setKey} autoCapitalize="none" autoCorrect={false} multiline style={{ maxHeight: 110 }} />
        </View>

        {error ? <Text style={{ color: c.danger, marginBottom: 12 }}>{error}</Text> : null}
        <Button title="Подключиться" icon="arrow-forward" onPress={submit} loading={busy} />

        <View style={{ marginTop: 24, padding: 14, borderRadius: radius.md, backgroundColor: c.surface, flexDirection: 'row', gap: 10 }}>
          <Ionicons name="shield-checkmark" size={20} color={c.warning} />
          <Text style={{ color: c.textMuted, flex: 1, fontSize: 13, lineHeight: 18 }}>
            Никогда не вводите сюда секретный ключ service_role. Нужен только публичный ключ.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
