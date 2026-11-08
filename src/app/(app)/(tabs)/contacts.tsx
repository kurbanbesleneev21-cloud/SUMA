import React, { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useColors } from '@/contexts/ThemeContext';
import { EmptyState, Field, Header, IconButton } from '@/components/ui';
import { PeopleList, SearchEmpty, useUserSearch } from '@/components/PeopleList';
import { TAB_BAR_SPACE } from '@/components/TabBar';
import { listContacts } from '@/services/users';
import { humanError } from '@/utils/errors';
import { useT } from '@/i18n';
import type { Profile } from '@/types';

export default function ContactsScreen() {
  const c = useColors();
  const t = useT();
  const router = useRouter();
  const { session } = useAuth();
  const [query, setQuery] = useState('');
  const [contacts, setContacts] = useState<Profile[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const search = useUserSearch(query, session!.user.id);

  useFocusEffect(
    useCallback(() => {
      listContacts()
        .then((list) => {
          setContacts(list);
          setError(null);
        })
        .catch((e) => setError(humanError(e)));
    }, []),
  );

  const searchingMode = search.results !== null || search.searching;
  const open = (p: Profile) => router.push({ pathname: '/user/[id]', params: { id: p.id } });

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <Header title={t('tabs.contacts')} right={<IconButton icon="person-add" label={t('chats.newChat')} onPress={() => router.push('/new-chat')} />} />
      <View style={{ paddingHorizontal: 16 }}>
        <Field icon="at" placeholder={t('contacts.searchPlaceholder')} value={query} onChangeText={setQuery} autoCapitalize="none" autoCorrect={false} />
      </View>
      {searchingMode ? (
        <PeopleList people={search.results ?? []} loading={search.searching} error={search.error} empty={<SearchEmpty />} onPress={open} bottomSpace={TAB_BAR_SPACE} />
      ) : (
        <PeopleList
          people={contacts ?? []}
          loading={contacts === null && !error}
          error={error}
          bottomSpace={TAB_BAR_SPACE}
          header={
            contacts && contacts.length > 0 ? (
              <Text style={{ color: c.textMuted, fontSize: 13, fontWeight: '600', textTransform: 'uppercase', marginHorizontal: 20, marginBottom: 6 }}>
                {t('contacts.mine', { count: contacts.length })}
              </Text>
            ) : null
          }
          empty={<EmptyState icon="people" title={t('contacts.emptyTitle')} text={t('contacts.emptyText')} />}
          onPress={open}
        />
      )}
    </View>
  );
}
