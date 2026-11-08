import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { useColors } from '@/contexts/ThemeContext';
import { Header } from '@/components/ui';
import { fingerprint } from '@/crypto/box';
import { radius } from '@/constants/theme';

export default function SecurityScreen() {
  const c = useColors();
  const { keys, keyWasReplaced } = useAuth();

  const point = (icon: React.ComponentProps<typeof Ionicons>['name'], text: string, color = c.primary) => (
    <View style={{ flexDirection: 'row', gap: 12, marginBottom: 14 }}>
      <Ionicons name={icon} size={20} color={color} />
      <Text style={{ color: c.text, flex: 1, lineHeight: 20 }}>{text}</Text>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <Header title="Шифрование" back />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <View style={{ padding: 20, borderRadius: radius.lg, backgroundColor: c.surface, alignItems: 'center', marginBottom: 20 }}>
          <Text style={{ color: c.textMuted, marginBottom: 10 }}>Ваш код безопасности</Text>
          <Text selectable style={{ color: c.text, fontSize: 22, fontWeight: '700', letterSpacing: 2, textAlign: 'center', lineHeight: 34 }}>
            {keys ? fingerprint(keys.publicKey) : '…'}
          </Text>
          <Text style={{ color: c.textMuted, fontSize: 12, marginTop: 10, textAlign: 'center' }}>
            Код собеседника открывается в его профиле. Если коды у вас обоих совпадают с тем, что видит другой, ключ не подменён.
          </Text>
        </View>

        {keyWasReplaced ? (
          <View style={{ padding: 14, borderRadius: radius.md, borderWidth: 1, borderColor: c.warning, marginBottom: 20 }}>
            {point('warning', 'На этом устройстве создан новый ключ. Сообщения, зашифрованные старым ключом (до переустановки или с другого телефона), прочитать невозможно — восстановить их нельзя.', c.warning)}
          </View>
        ) : null}

        <Text style={{ color: c.text, fontSize: 17, fontWeight: '700', marginBottom: 14 }}>Как это работает</Text>
        {point('phone-portrait', 'Секретный ключ создаётся на телефоне и хранится в защищённом хранилище (Android Keystore / iOS Keychain). На сервер он не отправляется.')}
        {point('lock-closed', 'Текст сообщения шифруется до отправки (X25519 + XSalsa20-Poly1305). Сервер видит только шифротекст, время и участников переписки.')}
        {point('shield-checkmark', 'Изменённое или повреждённое сообщение не расшифруется — подделку видно сразу.')}

        <Text style={{ color: c.text, fontSize: 17, fontWeight: '700', marginVertical: 14 }}>Ограничения этой версии</Text>
        {point('alert-circle', 'Нет прямой секретности (forward secrecy): при краже секретного ключа можно прочитать прошлые сообщения. Протокол Signal пока не внедрён.', c.warning)}
        {point('alert-circle', 'Один ключ на аккаунт и устройство: вход с другого телефона создаёт новый ключ, и старая переписка там недоступна.', c.warning)}
        {point('alert-circle', 'Группы, вложения и голосовые сообщения пока не реализованы.', c.warning)}
      </ScrollView>
    </View>
  );
}
