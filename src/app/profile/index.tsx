import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { useColors } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { router } from 'expo-router';

export default function ProfileScreen() {
  const colors = useColors();
  const { user, updateProfile, loading } = useAuth();
  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [statusMessage, setStatusMessage] = useState(user?.status_message || '');

  const handleSaveProfile = async () => {
    if (!fullName.trim()) {
      Alert.alert('Ошибка', 'Имя не может быть пустым');
      return;
    }

    try {
      await updateProfile({
        full_name: fullName,
        status_message: statusMessage,
      });
      Alert.alert('Успешно', 'Профиль обновлен');
      setEditing(false);
    } catch (error: any) {
      Alert.alert('Ошибка', error.message);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ color: colors.primary, fontSize: 18 }}>←</Text>
        </TouchableOpacity>
        <Text style={{ color: colors.text, fontSize: 18, fontWeight: 'bold', flex: 1, marginLeft: 12 }}>
          Профиль
        </Text>
        {!editing && (
          <TouchableOpacity onPress={() => setEditing(true)}>
            <Text style={{ color: colors.primary }}>Редактировать</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView contentContainerStyle={{ paddingVertical: 20 }}>
        {/* Аватар */}
        <View style={{ alignItems: 'center', marginBottom: 30 }}>
          <View
            style={[
              styles.avatar,
              {
                backgroundColor: colors.primary,
                width: 120,
                height: 120,
              },
            ]}
          >
            <Text style={{ color: '#fff', fontSize: 48, fontWeight: 'bold' }}>
              {user?.full_name?.[0]?.toUpperCase() || '?'}
            </Text>
          </View>
        </View>

        {/* Информация */}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.label, { color: colors.text }]}>Email</Text>
          <Text style={{ color: colors.textSecondary, paddingHorizontal: 15, paddingBottom: 15 }}>
            {user?.email}
          </Text>

          <Text style={[styles.label, { color: colors.text }]}>Username</Text>
          <Text style={{ color: colors.textSecondary, paddingHorizontal: 15, paddingBottom: 15 }}>
            @{user?.username}
          </Text>

          {editing ? (
            <>
              <Text style={[styles.label, { color: colors.text }]}>Имя</Text>
              <TextInput
                value={fullName}
                onChangeText={setFullName}
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.background,
                    color: colors.text,
                    borderColor: colors.border,
                  },
                ]}
              />

              <Text style={[styles.label, { color: colors.text }]}>Статус</Text>
              <TextInput
                value={statusMessage}
                onChangeText={setStatusMessage}
                placeholder="Расскажите о себе..."
                placeholderTextColor={colors.textSecondary}
                multiline
                maxLength={150}
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.background,
                    color: colors.text,
                    borderColor: colors.border,
                    minHeight: 80,
                  },
                ]}
              />

              <TouchableOpacity
                onPress={handleSaveProfile}
                disabled={loading}
                style={[
                  styles.button,
                  {
                    backgroundColor: colors.primary,
                    opacity: loading ? 0.6 : 1,
                  },
                ]}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold' }}>
                    Сохранить
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setEditing(false)}
                style={[styles.button, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }]}
              >
                <Text style={{ color: colors.text, fontSize: 16, fontWeight: 'bold' }}>
                  Отмена
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={[styles.label, { color: colors.text }]}>Имя</Text>
              <Text style={{ color: colors.textSecondary, paddingHorizontal: 15, paddingBottom: 15 }}>
                {user?.full_name}
              </Text>

              <Text style={[styles.label, { color: colors.text }]}>Статус</Text>
              <Text style={{ color: colors.textSecondary, paddingHorizontal: 15, paddingBottom: 15 }}>
                {user?.status_message || 'Нет статуса'}
              </Text>

              <Text style={[styles.label, { color: colors.text }]}>Дата регистрации</Text>
              <Text style={{ color: colors.textSecondary, paddingHorizontal: 15 }}>
                {new Date(user?.created_at || '').toLocaleDateString('ru-RU')}
              </Text>
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
  },
  avatar: {
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  section: {
    marginHorizontal: 15,
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 15,
  },
  button: {
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginBottom: 10,
  },
});
