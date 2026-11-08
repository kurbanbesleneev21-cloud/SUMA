import React from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { TextSize, ThemeMode, useColors, useTheme } from '@/contexts/ThemeContext';
import { Header, OptionList, Row, Section, tap } from '@/components/ui';
import { AccentId, accents, radius } from '@/constants/theme';
import { useT, TKey } from '@/i18n';

const accentNames: Record<AccentId, TKey> = {
  violet: 'appearance.violet',
  blue: 'appearance.blue',
  pink: 'appearance.pink',
  emerald: 'appearance.emerald',
  amber: 'appearance.amber',
};

export default function AppearanceScreen() {
  const c = useColors();
  const t = useT();
  const { mode, accent, textSize, animations, fs, update } = useTheme();

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <Header title={t('settings.appearance')} back />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={{ marginHorizontal: 16, marginBottom: 22, padding: 16, borderRadius: radius.lg, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, gap: 8 }}>
          <View style={{ alignSelf: 'flex-start', backgroundColor: c.bubbleOther, borderRadius: 18, borderBottomLeftRadius: 6, paddingHorizontal: 12, paddingVertical: 8, maxWidth: '80%', borderWidth: StyleSheet.hairlineWidth, borderColor: c.border }}>
            <Text style={{ color: c.bubbleOtherText, fontSize: fs(16) }}>{t('appearance.sampleIn')}</Text>
          </View>
          <LinearGradient colors={[c.gradient[0], c.gradient[2]]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ alignSelf: 'flex-end', borderRadius: 18, borderBottomRightRadius: 6, paddingHorizontal: 12, paddingVertical: 8, maxWidth: '80%' }}>
            <Text style={{ color: '#fff', fontSize: fs(16) }}>{t('appearance.sampleOut')}</Text>
          </LinearGradient>
        </View>

        <Section title={t('appearance.theme')}>
          <OptionList<ThemeMode>
            value={mode}
            onChange={(v) => update({ mode: v })}
            options={[
              { value: 'dark', label: t('appearance.dark') },
              { value: 'light', label: t('appearance.light') },
              { value: 'system', label: t('appearance.system') },
            ]}
          />
        </Section>

        <Section title={t('appearance.accent')}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 16 }}>
            {(Object.keys(accents) as AccentId[]).map((id) => (
              <Pressable
                key={id}
                onPress={() => {
                  tap();
                  update({ accent: id });
                }}
                accessibilityLabel={t(accentNames[id])}
                style={{ alignItems: 'center' }}
              >
                <LinearGradient colors={accents[id].gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: accent === id ? 3 : 0, borderColor: c.text }}>
                  {accent === id ? <Ionicons name="checkmark" size={22} color="#fff" /> : null}
                </LinearGradient>
                <Text style={{ color: c.textMuted, fontSize: 11, marginTop: 6 }}>{t(accentNames[id])}</Text>
              </Pressable>
            ))}
          </View>
        </Section>

        <Section title={t('appearance.textSize')}>
          <OptionList<TextSize>
            value={textSize}
            onChange={(v) => update({ textSize: v })}
            options={[
              { value: 'small', label: t('appearance.small') },
              { value: 'normal', label: t('appearance.normal') },
              { value: 'large', label: t('appearance.large') },
            ]}
          />
        </Section>

        <Section footer={t('appearance.animationsFooter')}>
          <Row icon="sparkles" label={t('appearance.animations')} right={<Switch value={animations} onValueChange={(v) => update({ animations: v })} trackColor={{ true: c.primary, false: c.border }} thumbColor="#fff" />} last />
        </Section>
      </ScrollView>
    </View>
  );
}
