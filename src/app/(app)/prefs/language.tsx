import React from 'react';
import { View } from 'react-native';
import { useColors } from '@/contexts/ThemeContext';
import { Header, OptionList, Section } from '@/components/ui';
import { dictionaries, Locale, localeNames, useI18n } from '@/i18n';

export default function LanguageScreen() {
  const c = useColors();
  const { t, locale, setLocale } = useI18n();
  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <Header title={t('settings.language')} back />
      <View style={{ paddingTop: 8 }}>
        <Section footer={t('language.footer')}>
          <OptionList<Locale> value={locale} onChange={setLocale} options={(Object.keys(dictionaries) as Locale[]).map((l) => ({ value: l, label: localeNames[l] }))} />
        </Section>
      </View>
    </View>
  );
}
