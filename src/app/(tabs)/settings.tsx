import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native';
import { useColors, useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { router } from 'expo-router';

export default function SettingsScreen() {
  const colors = useColors();
  const { theme, toggleTheme } = useTheme();
  const { signOut, user } = useAuth();

  const handleSignOut = async () => {
    Alert.alert('Выход', 'Вы уверены, что хотите выйти?', [
      { text: 'Отмена', onPress: () => {} },
      {
        text: 'Выйти',
        onPress: async () => {
          try {
            await signOut();
            router.replace('/auth/signin');
          } catch (error) {
            Alert.alert('Ошибка', 'Не удалось выйти из аккаунта');
          }
        },
      },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Удаление аккаунта',
      'Это действие необратимо. Все ваши данные будут удалены.',
      [
        { text: 'Отмена', onPress: () => {} },
        {
          text: 'Удалить',
          onPress: async () => {
            // TODO: Реализовать удаление аккаунта
            Alert.alert('Ошибка', 'Функция еще не реализована');
          },
        },
      ]
    );
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: 20 }}
    >
      <View style={[styles.header, { backgroundColor: colors.surface }]}>
        <Text style={[styles.title, { color: colors.text }]}>Настройки</Text>
      </View>

      {/* Профиль */}
      <View style={[styles.section, { backgroundColor: colors.surface, marginTop: 15 }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Профиль</Text>
        <TouchableOpacity
          onPress={() => router.push('/profile')}
          style={[
            styles.settingItem,
            { borderBottomColor: colors.border, borderBottomWidth: 1 },
          ]}
        >
          <Text style={{ color: colors.text, fontSize: 16 }}>Мой профиль</Text>
          <Text style={{ color: colors.textSecondary }}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => router.push('/blocked-users')}
          style={styles.settingItem}
        >
          <Text style={{ color: colors.text, fontSize: 16 }}>Заблокированные</Text>
          <Text style={{ color: colors.textSecondary }}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Внешний вид */}
      <View style={[styles.section, { backgroundColor: colors.surface }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Внешний вид</Text>
        <View style={[styles.settingItem, { justifyContent: 'space-between' }]}>
          <Text style={{ color: colors.text, fontSize: 16 }}>Темная тема</Text>
          <Switch
            value={theme === 'dark'}
            onValueChange={toggleTheme}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor={theme === 'dark' ? colors.primaryLight : colors.textSecondary}
          />
        </View>
      </View>

      {/* Приватность и безопасность */}
      <View style={[styles.section, { backgroundColor: colors.surface }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Приватность и безопасность
        </Text>
        <TouchableOpacity
          onPress={() => Alert.alert('Информация', 'Все сообщения зашифрованы E2EE')}
          style={[
            styles.settingItem,
            { borderBottomColor: colors.border, borderBottomWidth: 1 },
          ]}
        >
          <Text style={{ color: colors.text, fontSize: 16 }}>
            End-to-End Encryption
          </Text>
          <Text style={{ color: colors.success }}>✓</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => router.push('/change-password')}
          style={styles.settingItem}
        >
          <Text style={{ color: colors.text, fontSize: 16 }}>Изменить пароль</Text>
          <Text style={{ color: colors.textSecondary }}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Уведомления */}
      <View style={[styles.section, { backgroundColor: colors.surface }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Уведомления</Text>
        <TouchableOpacity
          onPress={() => router.push('/notifications')}
          style={styles.settingItem}
        >
          <Text style={{ color: colors.text, fontSize: 16 }}>Настройки</Text>
          <Text style={{ color: colors.textSecondary }}>›</Text>
        </TouchableOpacity>
      </View>

      {/* О приложении */}
      <View style={[styles.section, { backgroundColor: colors.surface }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>О приложении</Text>
        <View style={[styles.settingItem, { borderBottomColor: colors.border, borderBottomWidth: 1 }]}>
          <Text style={{ color: colors.text, fontSize: 16 }}>Версия</Text>
          <Text style={{ color: colors.textSecondary }}>1.0.0</Text>
        </View>
        <TouchableOpacity
          onPress={() => Alert.alert('Помощь', 'Посетите нашу поддержку')}
          style={[
            styles.settingItem,
            { borderBottomColor: colors.border, borderBottomWidth: 1 },
          ]}
        >
          <Text style={{ color: colors.text, fontSize: 16 }}>Помощь</Text>
          <Text style={{ color: colors.textSecondary }}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => Alert.alert('Лицензия', 'Лицензионное соглашение')}
          style={styles.settingItem}
        >
          <Text style={{ color: colors.text, fontSize: 16 }}>Лицензия</Text>
          <Text style={{ color: colors.textSecondary }}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Действия */}
      <View style={[styles.section, { backgroundColor: colors.surface }]}>
        <TouchableOpacity
          onPress={handleSignOut}
          style={[styles.settingItem, { borderBottomColor: colors.border, borderBottomWidth: 1 }]}
        >
          <Text style={{ color: colors.secondary, fontSize: 16 }}>Выход</Text>
          <Text style={{ color: colors.secondary }}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleDeleteAccount}
          style={styles.settingItem}
        >
          <Text style={{ color: colors.danger, fontSize: 16 }}>Удалить аккаунт</Text>
          <Text style={{ color: colors.danger }}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Информация о пользователе */}
      <View style={{ paddingHorizontal: 15, marginTop: 30, alignItems: 'center' }}>
        <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
          {user?.email}
        </Text>
        <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 4 }}>
          ID: {user?.id?.substring(0, 8)}...
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 15,
    paddingTop: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  section: {
    marginHorizontal: 15,
    marginBottom: 15,
    borderRadius: 12,
    overflow: 'hidden',
  },
  sectionTitle: {
    padding: 15,
    fontSize: 14,
    fontWeight: '600',
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
  },
});
