import React from 'react';
import { KeyboardAvoidingView, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/contexts/ThemeContext';

export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: c.background }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 24, paddingTop: insets.top + 48, paddingBottom: insets.bottom + 24 }} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 36 }}>
          <View style={{ width: 48, height: 48, borderRadius: 15, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            <View style={{ position: 'absolute', right: -16, bottom: -16, width: 48, height: 48, borderRadius: 24, backgroundColor: c.accent, opacity: 0.8 }} />
            <Text style={{ color: '#fff', fontSize: 24, fontWeight: '900' }}>N</Text>
          </View>
          <Text style={{ color: c.text, fontSize: 26, fontWeight: '900', marginLeft: 12, letterSpacing: 4 }}>NEXO</Text>
        </View>
        <Text style={{ color: c.text, fontSize: 30, fontWeight: '800' }}>{title}</Text>
        <Text style={{ color: c.textMuted, fontSize: 15, marginTop: 6, marginBottom: 28, lineHeight: 21 }}>{subtitle}</Text>
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
