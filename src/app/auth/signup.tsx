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

export default function SignUpScreen() {
  const colors = useColors();
  const { signUp, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleSignUp = async () => {
    if (!email || !password || !fullName || !confirmPassword) {
      Alert.alert('Ошибка', 'Пожалуйста, заполните все поля');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Ошибка', 'Пароли не совпадают');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Ошибка', 'Пароль должен быть не менее 6 символов');
      return;
    }

    try {
      await signUp(email, password, fullName);
      Alert.alert(
        'Успешно',
        'Проверьте вашу почту для подтверждения аккаунта'
      );
      router.push('/auth/signin');
    } catch (error: any) {
      Alert.alert('Ошибка регистрации', error.message);
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
            Создайте аккаунт
          </Text>

          <TextInput
            placeholder="Полное имя"
            placeholderTextColor={colors.textSecondary}
            value={fullName}
            onChangeText={setFullName}
            style={{
              backgroundColor: colors.surface,
              borderRadius: 12,
              padding: 15,
              marginBottom: 15,
              color: colors.text,
              borderWidth: 1,
              borderColor: colors.border,
            }}
            editable={!loading}
          />

          <TextInput
            placeholder="Email"
            placeholderTextColor={colors.textSecondary}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            style={{
              backgroundColor: colors.surface,
              borderRadius: 12,
              padding: 15,
              marginBottom: 15,
              color: colors.text,
              borderWidth: 1,
              borderColor: colors.border,
            }}
            editable={!loading}
          />

          <TextInput
            placeholder="Пароль"
            placeholderTextColor={colors.textSecondary}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            style={{
              backgroundColor: colors.surface,
              borderRadius: 12,
              padding: 15,
              marginBottom: 15,
              color: colors.text,
              borderWidth: 1,
              borderColor: colors.border,
            }}
            editable={!loading}
          />

          <TextInput
            placeholder="Подтвердите пароль"
            placeholderTextColor={colors.textSecondary}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
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
            onPress={handleSignUp}
            disabled={loading}
            style={{
              backgroundColor: colors.primary,
              borderRadius: 12,
              padding: 15,
              alignItems: 'center',
              marginBottom: 15,
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
                Создать аккаунт
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.push('/auth/signin')}>
            <Text
              style={{
                color: colors.secondary,
                textAlign: 'center',
                textDecorationLine: 'underline',
              }}
            >
              Уже есть аккаунт? Войти
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
