import React from 'react';
import { View } from 'react-native';
import { useColors } from '@/contexts/ThemeContext';
import { EmptyState, Header } from '@/components/ui';

export default function GroupsScreen() {
  const c = useColors();
  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <Header title="Группы" />
      <EmptyState
        icon="albums"
        title="Группы — в следующей версии"
        text="Групповые чаты требуют отдельной схемы шифрования: ключ группы нужно выдавать каждому участнику и менять при исключении участника. Это ещё не сделано, а создавать незашифрованные группы мы не стали."
      />
    </View>
  );
}
