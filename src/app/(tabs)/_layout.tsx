import React from 'react';
import { BottomTabNavigationOptions } from '@react-navigation/bottom-tabs';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useColors } from '@/contexts/ThemeContext';
import ChatsScreen from './chats';
import ContactsScreen from './contacts';
import CallsScreen from './calls';
import GroupsScreen from './groups';
import SettingsScreen from './settings';
import { Text } from 'react-native';

const Tab = createBottomTabNavigator();

const tabBarOptions = (colors: any): BottomTabNavigationOptions => ({
  tabBarActiveTintColor: colors.primary,
  tabBarInactiveTintColor: colors.textSecondary,
  tabBarStyle: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: 1,
  },
  headerShown: false,
});

export default function TabsLayout() {
  const colors = useColors();

  return (
    <Tab.Navigator screenOptions={tabBarOptions(colors)}>
      <Tab.Screen
        name="chats"
        component={ChatsScreen}
        options={{
          title: 'Чаты',
          tabBarLabel: ({ focused }) => (
            <Text
              style={{
                color: focused ? colors.primary : colors.textSecondary,
                fontSize: 10,
              }}
            >
              Чаты
            </Text>
          ),
        }}
      />
      <Tab.Screen
        name="contacts"
        component={ContactsScreen}
        options={{
          title: 'Контакты',
          tabBarLabel: ({ focused }) => (
            <Text
              style={{
                color: focused ? colors.primary : colors.textSecondary,
                fontSize: 10,
              }}
            >
              Контакты
            </Text>
          ),
        }}
      />
      <Tab.Screen
        name="calls"
        component={CallsScreen}
        options={{
          title: 'Звонки',
          tabBarLabel: ({ focused }) => (
            <Text
              style={{
                color: focused ? colors.primary : colors.textSecondary,
                fontSize: 10,
              }}
            >
              Звонки
            </Text>
          ),
        }}
      />
      <Tab.Screen
        name="groups"
        component={GroupsScreen}
        options={{
          title: 'Группы',
          tabBarLabel: ({ focused }) => (
            <Text
              style={{
                color: focused ? colors.primary : colors.textSecondary,
                fontSize: 10,
              }}
            >
              Группы
            </Text>
          ),
        }}
      />
      <Tab.Screen
        name="settings"
        component={SettingsScreen}
        options={{
          title: 'Настройки',
          tabBarLabel: ({ focused }) => (
            <Text
              style={{
                color: focused ? colors.primary : colors.textSecondary,
                fontSize: 10,
              }}
            >
              Настройки
            </Text>
          ),
        }}
      />
    </Tab.Navigator>
  );
}
