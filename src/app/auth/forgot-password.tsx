import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useColors } from '@/contexts/ThemeContext';
import { router } from 'expo-router';

export default function ForgotPasswordScreen() {
  const colors = useColors();
  const { resetPassword, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

  const handleReset = async () => {
    if (!email) {
      Alert.alert('Ошибка', 'Пожалуйста, введите email');
      return;
    }

    try {
      await resetPassword(email);
      setSent(true);
      Alert.alert('Успешно', 'Проверьте вашу почту для восстановления пароля');
    } catch (error: any) {
      Alert.alert('Ошибка', error.message);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
    >
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ flexGrow: 1 }}
      >
        <View style={{ flex: 1, padding: 20, justifyContent: 'center' }}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={{ marginBottom: 20 }}
          >
            <Text style={{ color: colors.secondary, fontSize: 16 }}>
              ← Назад
            </Text>
          </TouchableOpacity>

          <Text
            style={{
              fontSize: 32,
              fontWeight: 'bold',
              color: colors.primary,
              marginBottom: 10,
              textAlign: 'center',
            }}
          >
            NEXO
          </Text>

          <Text
            style={{
              fontSize: 16,
              color: colors.textSecondary,
              textAlign: 'center',
              marginBottom: 30,
            }}
          >
            Восстановление пароля
          </Text>

          {!sent ? (
            <>
              <TextInput
                placeholder="Введите ваш email"
                placeholderTextColor={colors.textSecondary}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                style={{
                  backgroundColor: colors.surface,
                  borderRadius: 12,
                  padding: 15,
                  marginBottom: 20,
                  color: colors.text,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
                editable={!loading}
              />

              <TouchableOpacity
                onPress={handleReset}
                disabled={loading}
                style={{
                  backgroundColor: colors.primary,
                  borderRadius: 12,
                  padding: 15,
                  alignItems: 'center',
                  opacity: loading ? 0.6 : 1,
                }}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text
                    style={{
                      color: '#fff',
                      fontSize: 16,
                      fontWeight: 'bold',
                    }}
                  >
                    Отправить письмо
                  </Text>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <View style={{ alignItems: 'center' }}>
              <Text
                style={{
                  color: colors.text,
                  fontSize: 16,
                  marginBottom: 20,
                }}
              >
                ✓ Письмо отправлено на {email}
              </Text>
              <TouchableOpacity
                onPress={() => router.push('/auth/signin')}
                style={{
                  backgroundColor: colors.primary,
                  borderRadius: 12,
                  padding: 15,
                  alignItems: 'center',
                  width: '100%',
                }}
              >
                <Text
                  style={{
                    color: '#fff',
                    fontSize: 16,
                    fontWeight: 'bold',
                  }}
                >
                  Вернуться к входу
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
