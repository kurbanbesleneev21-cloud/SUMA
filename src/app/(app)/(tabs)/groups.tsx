import React from 'react';
import { View } from 'react-native';
import { useColors } from '@/contexts/ThemeContext';
import { EmptyState, Header } from '@/components/ui';
import { useT } from '@/i18n';

export default function GroupsScreen() {
  const c = useColors();
  const t = useT();
  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <Header title={t('tabs.groups')} />
      <EmptyState icon="albums" title={t('groups.notYetTitle')} text={t('groups.notYetText')} />
    </View>
  );
}
