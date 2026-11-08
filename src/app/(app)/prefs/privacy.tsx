import React, { useState } from 'react';
import { ScrollView, Switch, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useColors } from '@/contexts/ThemeContext';
import { ActionSheet, ErrorBanner, Header, Loading, Row, Section } from '@/components/ui';
import { useUserSettings } from '@/hooks/useUserSettings';
import { useT, TKey } from '@/i18n';
import type { UserSettings, Visibility } from '@/types';

type VisibilityField = 'last_seen_visibility' | 'online_visibility' | 'who_can_message';

const labels: Record<Visibility, TKey> = { everyone: 'privacy.everyone', contacts: 'privacy.contacts', nobody: 'privacy.nobody' };

export default function PrivacyScreen() {
  const c = useColors();
  const t = useT();
  const router = useRouter();
  const { settings, error, reload, update } = useUserSettings();
  const [editing, setEditing] = useState<VisibilityField | null>(null);

  if (!settings && !error) return <Loading />;

  const rows: { field: VisibilityField; label: TKey; icon: 'time' | 'radio-button-on' | 'chatbubbles' }[] = [
    { field: 'last_seen_visibility', label: 'privacy.lastSeen', icon: 'time' },
    { field: 'online_visibility', label: 'privacy.online', icon: 'radio-button-on' },
    { field: 'who_can_message', label: 'privacy.whoCanMessage', icon: 'chatbubbles' },
  ];

  const titles: Record<VisibilityField, TKey> = {
    last_seen_visibility: 'privacy.lastSeen',
    online_visibility: 'privacy.online',
    who_can_message: 'privacy.whoCanMessage',
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <Header title={t('settings.privacy')} back />
      {error ? <ErrorBanner message={error} onRetry={reload} /> : null}
      {settings ? (
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
          <Section title={t('privacy.whoSees')} footer={t('privacy.footer')}>
            {rows.map((r, i) => (
              <Row key={r.field} icon={r.icon} label={t(r.label)} value={t(labels[settings[r.field] as Visibility])} onPress={() => setEditing(r.field)} last={i === rows.length - 1} />
            ))}
          </Section>
          <Section footer={t('privacy.readReceiptsFooter')}>
            <Row
              icon="checkmark-done"
              label={t('privacy.readReceipts')}
              right={<Switch value={settings.read_receipts} onValueChange={(v) => update({ read_receipts: v })} trackColor={{ true: c.primary, false: c.border }} thumbColor="#fff" />}
              last
            />
          </Section>
          <Section footer={t('privacy.laterFooter')}>
            <Row icon="ban" label={t('privacy.blocked')} onPress={() => router.push('/blocked')} last />
          </Section>
        </ScrollView>
      ) : null}
      <ActionSheet
        visible={!!editing}
        title={editing ? t(titles[editing]) : undefined}
        actions={(['everyone', 'contacts', 'nobody'] as Visibility[]).map((v) => ({
          label: t(labels[v]) + (editing && settings?.[editing as keyof UserSettings] === v ? ' ✓' : ''),
          icon: v === 'everyone' ? 'globe' : v === 'contacts' ? 'people' : 'eye-off',
          onPress: () => editing && update({ [editing]: v }),
        }))}
        onClose={() => setEditing(null)}
      />
    </View>
  );
}
