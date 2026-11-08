import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/contexts/AuthContext';
import { useColors } from '@/contexts/ThemeContext';
import { Header } from '@/components/ui';
import { fingerprint } from '@/crypto/box';
import { radius } from '@/constants/theme';
import { useT, TKey } from '@/i18n';

export default function EncryptionScreen() {
  const c = useColors();
  const t = useT();
  const { keys, keyWasReplaced } = useAuth();

  const point = (icon: React.ComponentProps<typeof Ionicons>['name'], key: TKey, color = c.primary) => (
    <View key={key} style={{ flexDirection: 'row', gap: 12, marginBottom: 14 }}>
      <Ionicons name={icon} size={20} color={color} />
      <Text style={{ color: c.text, flex: 1, lineHeight: 20 }}>{t(key)}</Text>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <Header title={t('encryption.title')} back />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <LinearGradient colors={[c.navy, c.surface]} style={{ padding: 20, borderRadius: radius.lg, alignItems: 'center', marginBottom: 20, borderWidth: 1, borderColor: c.border }}>
          <Text style={{ color: c.textMuted, marginBottom: 10 }}>{t('encryption.myCode')}</Text>
          <Text selectable style={{ color: c.text, fontSize: 22, fontWeight: '700', letterSpacing: 2, textAlign: 'center', lineHeight: 34 }}>
            {keys ? fingerprint(keys.publicKey) : '…'}
          </Text>
          <Text style={{ color: c.textMuted, fontSize: 12, marginTop: 10, textAlign: 'center' }}>{t('encryption.codeHint')}</Text>
        </LinearGradient>

        {keyWasReplaced ? (
          <View style={{ padding: 14, borderRadius: radius.md, borderWidth: 1, borderColor: c.warning, marginBottom: 20 }}>{point('warning', 'encryption.replaced', c.warning)}</View>
        ) : null}

        <Text style={{ color: c.text, fontSize: 17, fontWeight: '700', marginBottom: 14 }}>{t('encryption.how')}</Text>
        {point('phone-portrait', 'encryption.p1')}
        {point('lock-closed', 'encryption.p2')}
        {point('shield-checkmark', 'encryption.p3')}

        <Text style={{ color: c.text, fontSize: 17, fontWeight: '700', marginVertical: 14 }}>{t('encryption.limits')}</Text>
        {point('alert-circle', 'encryption.l1', c.warning)}
        {point('alert-circle', 'encryption.l2', c.warning)}
        {point('alert-circle', 'encryption.l3', c.warning)}
      </ScrollView>
    </View>
  );
}
