import React from 'react';
import { Tabs } from 'expo-router';
import { useColors, useTheme } from '@/contexts/ThemeContext';
import { TabBar } from '@/components/TabBar';

export default function TabsLayout() {
  const c = useColors();
  const { animations } = useTheme();
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: c.background },
        animation: animations ? 'shift' : 'none',
      }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="contacts" />
      <Tabs.Screen name="calls" />
      <Tabs.Screen name="groups" />
      <Tabs.Screen name="settings" />
    </Tabs>
  );
}
