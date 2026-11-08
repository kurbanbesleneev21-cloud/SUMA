import React, { useState } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { useColors } from '@/contexts/ThemeContext';
import { Button, Field, Logo } from '@/components/ui';
import { radius } from '@/constants/theme';
import { useT } from '@/i18n';

export default function SetupScreen() {
  const c = useColors();
  const t = useT();
  const insets = useSafeAreaInsets();
  const { configure } = useAuth();
  const [url, setUrl] = useState('');
  const [key, setKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    if (!url.trim() || !key.trim()) return setError(t('setup.fillBoth'));
    setBusy(true);
    try {
      await configure(url, key);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('setup.errUnreachable'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: c.background }}>
      <LinearGradient colors={[c.navy, c.background]} style={StyleSheet.absoluteFill} />
      <ScrollView contentContainerStyle={{ padding: 24, paddingTop: insets.top + 40 }} keyboardShouldPersistTaps="handled">
        <Logo size={44} />
        <Text style={{ color: c.text, fontSize: 28, fontWeight: '800', marginTop: 28 }}>{t('setup.title')}</Text>
        <Text style={{ color: c.textMuted, fontSize: 15, marginTop: 8, lineHeight: 21 }}>{t('setup.text')}</Text>
        <View style={{ marginTop: 28 }}>
          <Field label="Project URL" icon="link" placeholder="https://xxxx.supabase.co" value={url} onChangeText={setUrl} autoCapitalize="none" autoCorrect={false} keyboardType="url" />
          <Field label={t('setup.keyLabel')} icon="key" placeholder="sb_publishable_..." value={key} onChangeText={setKey} autoCapitalize="none" autoCorrect={false} multiline style={{ maxHeight: 110 }} />
        </View>
        {error ? <Text style={{ color: c.danger, marginBottom: 12 }}>{error}</Text> : null}
        <Button title={t('setup.connect')} icon="arrow-forward" onPress={submit} loading={busy} />
        <View style={{ marginTop: 24, padding: 14, borderRadius: radius.md, backgroundColor: c.surface, flexDirection: 'row', gap: 10 }}>
          <Ionicons name="shield-checkmark" size={20} color={c.warning} />
          <Text style={{ color: c.textMuted, flex: 1, fontSize: 13, lineHeight: 18 }}>{t('setup.warning')}</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
