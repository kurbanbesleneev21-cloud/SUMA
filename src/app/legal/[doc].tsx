import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useLocalSearchParams } from 'expo-router';
import { useColors } from '@/contexts/ThemeContext';
import { Header, useEntering } from '@/components/ui';
import { useI18n } from '@/i18n';
import { LegalDoc, legalDocs } from '@/constants/legal';

export default function LegalScreen() {
  const c = useColors();
  const { locale } = useI18n();
  const entering = useEntering();
  const { doc } = useLocalSearchParams<{ doc: string }>();
  const key: LegalDoc = doc === 'terms' || doc === 'help' ? doc : 'privacy';
  const d = legalDocs[locale][key];

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <Header title={d.title} back />
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 48 }}>
        {d.updated ? <Text style={{ color: c.textMuted, marginBottom: 18 }}>{d.updated}</Text> : null}
        {d.sections.map((s, i) => (
          <Animated.View key={s.h} entering={entering(i * 40)} style={{ marginBottom: 20 }}>
            <Text style={{ color: c.text, fontSize: 17, fontWeight: '700', marginBottom: 6 }}>{s.h}</Text>
            <Text style={{ color: c.textMuted, fontSize: 15, lineHeight: 22 }}>{s.p}</Text>
          </Animated.View>
        ))}
      </ScrollView>
    </View>
  );
}
