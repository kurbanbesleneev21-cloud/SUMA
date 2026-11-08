import React, { useEffect, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from 'expo-router/build/layouts/Tabs';
import { useColors, useTheme } from '@/contexts/ThemeContext';
import { tap, IconName } from '@/components/ui';
import { useT, TKey } from '@/i18n';

const tabs: Record<string, { label: TKey; icon: IconName; active: IconName }> = {
  index: { label: 'tabs.chats', icon: 'chatbubbles-outline', active: 'chatbubbles' },
  contacts: { label: 'tabs.contacts', icon: 'people-outline', active: 'people' },
  calls: { label: 'tabs.calls', icon: 'call-outline', active: 'call' },
  groups: { label: 'tabs.groups', icon: 'albums-outline', active: 'albums' },
  settings: { label: 'tabs.settings', icon: 'settings-outline', active: 'settings' },
};

export function TabBar({ state, emitter, navigateToTab }: BottomTabBarProps) {
  const c = useColors();
  const t = useT();
  const { scheme, animations } = useTheme();
  const insets = useSafeAreaInsets();
  const [width, setWidth] = useState(0);
  const tabWidth = width / state.routes.length;
  const x = useSharedValue(0);

  useEffect(() => {
    const target = state.index * tabWidth;
    x.value = animations ? withSpring(target, { damping: 18, stiffness: 180 }) : withTiming(target, { duration: 0 });
  }, [state.index, tabWidth, animations, x]);

  const indicator = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  return (
    <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}>
      <BlurView intensity={40} tint={scheme} style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: c.glass, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border }]} />
      <View onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)} style={{ flexDirection: 'row', paddingTop: 8, paddingBottom: Math.max(insets.bottom, 10) }}>
        {width > 0 ? (
          <Animated.View style={[{ position: 'absolute', top: 6, left: 0, width: tabWidth, alignItems: 'center' }, indicator]}>
            <LinearGradient colors={c.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: 56, height: 32, borderRadius: 16, opacity: 0.95 }} />
          </Animated.View>
        ) : null}
        {state.routes.map((route, i) => {
          const meta = tabs[route.name];
          if (!meta) return null;
          const focused = state.index === i;
          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={t(meta.label)}
              onPress={() => {
                const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                if (!focused && !event.defaultPrevented) {
                  tap();
                  navigateToTab(route.key);
                }
              }}
              style={{ flex: 1, alignItems: 'center' }}
            >
              <View style={{ height: 32, justifyContent: 'center' }}>
                <Ionicons name={focused ? meta.active : meta.icon} size={22} color={focused ? '#fff' : c.textMuted} />
              </View>
              <Text style={{ color: focused ? c.text : c.textMuted, fontSize: 11, fontWeight: focused ? '700' : '500', marginTop: 3 }} numberOfLines={1}>
                {t(meta.label)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export const TAB_BAR_SPACE = 96;
