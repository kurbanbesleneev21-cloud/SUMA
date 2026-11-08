import React from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, Text } from 'react-native';
import Animated from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/contexts/ThemeContext';
import { Logo, useEntering } from '@/components/ui';

export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const entering = useEntering();
  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: c.background }}>
      <LinearGradient colors={[c.navy, c.background, c.background]} locations={[0, 0.45, 1]} style={StyleSheet.absoluteFill} />
      <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 24, paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 }} keyboardShouldPersistTaps="handled">
        <Animated.View entering={entering()} style={{ marginBottom: 32 }}>
          <Logo size={46} />
        </Animated.View>
        <Animated.View entering={entering(80)}>
          <Text style={{ color: c.text, fontSize: 30, fontWeight: '800' }}>{title}</Text>
          <Text style={{ color: c.textMuted, fontSize: 15, marginTop: 6, marginBottom: 28, lineHeight: 21 }}>{subtitle}</Text>
        </Animated.View>
        <Animated.View entering={entering(160)} style={{ flexGrow: 1 }}>
          {children}
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
