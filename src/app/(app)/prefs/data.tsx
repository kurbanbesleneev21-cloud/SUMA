import React, { useCallback, useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useColors } from '@/contexts/ThemeContext';
import { Header, Row, Section } from '@/components/ui';
import { cacheSize, clearCache, formatBytes, MAX_FILE_BYTES } from '@/services/attachments';
import { useT } from '@/i18n';

export default function DataScreen() {
  const c = useColors();
  const t = useT();
  const [size, setSize] = useState<number | null>(null);

  const refresh = useCallback(() => {
    try {
      setSize(cacheSize());
    } catch {
      setSize(0);
    }
  }, []);

  useFocusEffect(refresh);

  const confirmClear = () =>
    Alert.alert(t('data.clearTitle'), t('data.clearText'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('data.clear'),
        style: 'destructive',
        onPress: () => {
          clearCache();
          refresh();
        },
      },
    ]);

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <Header title={t('settings.data')} back />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <Section title={t('data.storage')} footer={t('data.cacheFooter')}>
          <Row icon="pie-chart" label={t('data.cacheSize')} value={size === null ? '…' : formatBytes(size)} />
          <Row icon="trash" label={t('data.clear')} onPress={confirmClear} danger last />
        </Section>
        <Section title={t('data.autoDownload')} footer={t('data.autoFooter')}>
          <Row icon="image" label={t('data.photos')} value={t('data.auto')} />
          <Row icon="film" label={t('data.videos')} value={t('data.previewOnly')} />
          <Row icon="document" label={t('data.documents')} value={t('data.onTap')} last />
        </Section>
        <Section title={t('data.limits')}>
          <Row icon="cloud-upload" label={t('data.maxFile')} value={formatBytes(MAX_FILE_BYTES)} last />
        </Section>
      </ScrollView>
    </View>
  );
}
