import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { ColorValue } from 'react-native';
import { useColors } from '@/contexts/ThemeContext';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const tab = (title: string, icon: IconName, iconActive: IconName) => ({
  title,
  tabBarIcon: ({ color, focused, size }: { color: ColorValue; focused: boolean; size: number }) => (
    <Ionicons name={focused ? iconActive : icon} size={size} color={color as string} />
  ),
});

export default function TabsLayout() {
  const c = useColors();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.primary,
        tabBarInactiveTintColor: c.textMuted,
        tabBarStyle: { backgroundColor: c.surface, borderTopColor: c.border },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        sceneStyle: { backgroundColor: c.background },
      }}
    >
      <Tabs.Screen name="index" options={tab('Чаты', 'chatbubbles-outline', 'chatbubbles')} />
      <Tabs.Screen name="contacts" options={tab('Контакты', 'people-outline', 'people')} />
      <Tabs.Screen name="calls" options={tab('Звонки', 'call-outline', 'call')} />
      <Tabs.Screen name="groups" options={tab('Группы', 'albums-outline', 'albums')} />
      <Tabs.Screen name="settings" options={tab('Настройки', 'settings-outline', 'settings')} />
    </Tabs>
  );
}
