import React from 'react';
import { View } from 'react-native';
import { useColors } from '@/contexts/ThemeContext';
import { EmptyState, Header } from '@/components/ui';

export default function CallsScreen() {
  const c = useColors();
  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <Header title="Звонки" />
      <EmptyState
        icon="call"
        title="Звонки пока не реализованы"
        text="Для голосовых и видеозвонков нужны WebRTC и собственный TURN-сервер (например, coturn или платный сервис вроде LiveKit), а также ключи к нему. Без них звонки между разными сетями не работают, поэтому в этой версии кнопок звонка нет."
      />
    </View>
  );
}
