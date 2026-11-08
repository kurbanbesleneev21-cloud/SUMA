import React from 'react';
import { Linking, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { useColors } from '@/contexts/ThemeContext';
import { Header, Logo, Row, Section } from '@/components/ui';
import { useT } from '@/i18n';

const ISSUES_URL = 'https://github.com/kurbanbesleneev21-cloud/SUMA/issues';

export default function AboutScreen() {
  const c = useColors();
  const t = useT();
  const router = useRouter();
  const version = Constants.expoConfig?.version ?? '';
  const build = Constants.expoConfig?.android?.versionCode ?? '';
  const open = (doc: 'privacy' | 'terms' | 'help') => router.push({ pathname: '/legal/[doc]', params: { doc } });

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <Header title={t('settings.about')} back />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={{ alignItems: 'center', marginVertical: 24 }}>
          <Logo size={56} />
          <Text style={{ color: c.textMuted, marginTop: 12 }}>{t('about.version', { version, build: String(build) })}</Text>
        </View>
        <Section>
          <Row icon="document-text" label={t('about.privacy')} onPress={() => open('privacy')} />
          <Row icon="reader" label={t('about.terms')} onPress={() => open('terms')} />
          <Row icon="help-buoy" label={t('about.help')} onPress={() => open('help')} />
          <Row icon="chatbox-ellipses" label={t('about.feedback')} hint={t('about.feedbackHint')} onPress={() => Linking.openURL(ISSUES_URL)} last />
        </Section>
      </ScrollView>
    </View>
  );
}
