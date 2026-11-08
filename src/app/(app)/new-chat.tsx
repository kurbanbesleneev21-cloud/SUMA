import React, { useState } from 'react';
import { Alert, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useColors } from '@/contexts/ThemeContext';
import { EmptyState, Field, Header } from '@/components/ui';
import { PeopleList, SearchEmpty, useUserSearch } from '@/components/PeopleList';
import { openDirectChat } from '@/services/chats';
import { humanError } from '@/utils/errors';
import { useT } from '@/i18n';

export default function NewChatScreen() {
  const c = useColors();
  const t = useT();
  const router = useRouter();
  const { session } = useAuth();
  const [query, setQuery] = useState('');
  const { results, searching, error } = useUserSearch(query, session!.user.id);

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <Header title={t('chats.newChat')} back />
      <View style={{ paddingHorizontal: 16 }}>
        <Field icon="at" placeholder={t('contacts.searchPlaceholder')} value={query} onChangeText={setQuery} autoCapitalize="none" autoCorrect={false} autoFocus />
      </View>
      <PeopleList
        people={results ?? []}
        loading={searching}
        error={error}
        empty={results === null ? <EmptyState icon="search" title={t('contacts.searchTitle')} text={t('contacts.searchHint')} /> : <SearchEmpty />}
        onPress={async (p) => {
          if (!p.public_key) {
            router.push({ pathname: '/user/[id]', params: { id: p.id } });
            return;
          }
          try {
            const chatId = await openDirectChat(p.id);
            router.replace({ pathname: '/chat/[id]', params: { id: chatId } });
          } catch (e) {
            Alert.alert(t('user.cannotOpenChat'), humanError(e));
          }
        }}
      />
    </View>
  );
}
