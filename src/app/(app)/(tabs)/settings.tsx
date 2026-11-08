import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useAuth } from '@/contexts/AuthContext';
import { useColors, useTheme } from '@/contexts/ThemeContext';
import { useAppLock } from '@/contexts/AppLockContext';
import { Avatar, Header, Row, Section, useEntering } from '@/components/ui';
import { TAB_BAR_SPACE } from '@/components/TabBar';
import { radius } from '@/constants/theme';
import { localeNames, useI18n } from '@/i18n';

export default function SettingsScreen() {
  const c = useColors();
  const router = useRouter();
  const entering = useEntering();
  const { mode } = useTheme();
  const { t, locale } = useI18n();
  const { profile } = useAuth();
  const lock = useAppLock();

  const themeLabel = mode === 'dark' ? t('appearance.dark') : mode === 'light' ? t('appearance.light') : t('appearance.system');

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <Header title={t('tabs.settings')} />
      <ScrollView contentContainerStyle={{ paddingBottom: TAB_BAR_SPACE + 16 }}>
        <Animated.View entering={entering()}>
          <Pressable
            onPress={() => router.push('/profile')}
            style={{ marginHorizontal: 16, marginBottom: 22, padding: 16, borderRadius: radius.lg, backgroundColor: c.surface, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: c.border }}
          >
            <Avatar name={profile?.display_name ?? '?'} seed={profile?.id ?? 'me'} size={64} />
            <View style={{ marginLeft: 14, flex: 1 }}>
              <Text style={{ color: c.text, fontSize: 19, fontWeight: '700' }} numberOfLines={1}>
                {profile?.display_name ?? '…'}
              </Text>
              <Text style={{ color: c.textMuted, marginTop: 2 }}>@{profile?.username ?? '…'}</Text>
              <Text style={{ color: c.primary, marginTop: 6, fontSize: 13, fontWeight: '600' }}>{t('settings.editProfile')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={c.textMuted} />
          </Pressable>
        </Animated.View>

        <Animated.View entering={entering(50)}>
          <Section>
            <Row icon="shield-half" label={t('settings.privacy')} hint={t('settings.privacyHint')} onPress={() => router.push('/prefs/privacy')} />
            <Row icon="lock-closed" label={t('settings.security')} hint={lock.pinEnabled ? t('settings.securityHintOn') : t('settings.securityHint')} onPress={() => router.push('/prefs/security')} />
            <Row icon="color-palette" label={t('settings.appearance')} value={themeLabel} onPress={() => router.push('/prefs/appearance')} />
            <Row icon="language" label={t('settings.language')} value={localeNames[locale]} onPress={() => router.push('/prefs/language')} />
            <Row icon="server" label={t('settings.data')} onPress={() => router.push('/prefs/data')} last />
          </Section>
        </Animated.View>

        <Animated.View entering={entering(100)}>
          <Section footer={t('settings.pendingFooter')}>
            <Row icon="notifications" label={t('settings.notifications')} value={t('settings.stage5')} last />
          </Section>
        </Animated.View>

        <Animated.View entering={entering(150)}>
          <Section>
            <Row icon="information-circle" label={t('settings.about')} value={`NEXO ${Constants.expoConfig?.version ?? ''}`} onPress={() => router.push('/prefs/about')} last />
          </Section>
        </Animated.View>
      </ScrollView>
    </View>
  );
}
