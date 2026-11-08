import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, FlatList, KeyboardAvoidingView, Pressable, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { useColors } from '@/contexts/ThemeContext';
import { Avatar, ErrorBanner, Loading } from '@/components/ui';
import { sb } from '@/lib/supabase';
import {
  decryptRow,
  deleteMessage,
  editMessage,
  fetchChatPeer,
  fetchMessages,
  fetchPeerReadAt,
  markChatRead,
  MAX_MESSAGE_LENGTH,
  sendMessage,
} from '@/services/chats';
import { getProfile } from '@/services/users';
import { dayLabel, isOnline, lastSeenLabel, timeShort } from '@/utils/format';
import { humanError } from '@/utils/errors';
import type { DecryptedMessage, MessageRow, Profile } from '@/types';
import { radius } from '@/constants/theme';

type Pending = DecryptedMessage & { pending?: boolean };

export default function ChatScreen() {
  const c = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id: chatId } = useLocalSearchParams<{ id: string }>();
  const { session, keys } = useAuth();
  const myId = session!.user.id;

  const [peer, setPeer] = useState<Profile | null>(null);
  const [messages, setMessages] = useState<Pending[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<Pending | null>(null);
  const [editing, setEditing] = useState<Pending | null>(null);
  const [peerReadAt, setPeerReadAt] = useState<string | null>(null);
  const [peerTyping, setPeerTyping] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const typingChannel = useRef<ReturnType<ReturnType<typeof sb>['channel']> | null>(null);
  const lastTypingSent = useRef(0);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const decrypt = useCallback((row: MessageRow): Pending => (keys ? decryptRow(row, keys) : { ...row, text: null }), [keys]);

  const upsert = useCallback(
    (row: MessageRow) =>
      setMessages((prev) => {
        const list = prev ?? [];
        const msg = decrypt(row);
        const i = list.findIndex((m) => m.id === row.id);
        if (i >= 0) return list.map((m, j) => (j === i ? msg : m));
        return [msg, ...list].sort((a, b) => b.created_at.localeCompare(a.created_at));
      }),
    [decrypt],
  );

  const load = useCallback(async () => {
    try {
      const peerId = await fetchChatPeer(chatId, myId);
      const [rows, p, readAt] = await Promise.all([
        fetchMessages(chatId),
        peerId ? getProfile(peerId) : Promise.resolve(null),
        peerId ? fetchPeerReadAt(chatId, peerId) : Promise.resolve(null),
      ]);
      setPeer(p);
      setPeerReadAt(readAt);
      setMessages(rows.map(decrypt));
      setHasMore(rows.length >= 40);
      setError(null);
      markChatRead(chatId).catch(() => {});
    } catch (e) {
      setError(humanError(e));
      setMessages((m) => m ?? []);
    }
  }, [chatId, myId, decrypt]);

  useEffect(() => {
    if (keys) load();
  }, [keys, load]);

  useEffect(() => {
    const ch = sb()
      .channel(`chat:${chatId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `chat_id=eq.${chatId}` }, (payload) => {
        const row = payload.new as MessageRow;
        upsert(row);
        if (row.sender_id !== myId) {
          setPeerTyping(false);
          if (AppState.currentState === 'active') markChatRead(chatId).catch(() => {});
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `chat_id=eq.${chatId}` }, (payload) => upsert(payload.new as MessageRow))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chat_members', filter: `chat_id=eq.${chatId}` }, (payload) => {
        const row = payload.new as { user_id: string; last_read_at: string };
        if (row.user_id !== myId) setPeerReadAt(row.last_read_at);
      })
      .subscribe();

    const typing = sb()
      .channel(`typing:${chatId}`)
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        if (payload?.user === myId) return;
        setPeerTyping(true);
        if (typingTimeout.current) clearTimeout(typingTimeout.current);
        typingTimeout.current = setTimeout(() => setPeerTyping(false), 3500);
      })
      .subscribe();
    typingChannel.current = typing;

    return () => {
      sb().removeChannel(ch);
      sb().removeChannel(typing);
      if (typingTimeout.current) clearTimeout(typingTimeout.current);
    };
  }, [chatId, myId, upsert]);

  const onChangeText = (t: string) => {
    setText(t);
    const now = Date.now();
    if (t && now - lastTypingSent.current > 2000) {
      lastTypingSent.current = now;
      typingChannel.current?.send({ type: 'broadcast', event: 'typing', payload: { user: myId } }).catch(() => {});
    }
  };

  const loadOlder = async () => {
    if (!messages?.length || loadingOlder || !hasMore) return;
    setLoadingOlder(true);
    try {
      const rows = await fetchMessages(chatId, messages[messages.length - 1].created_at);
      setHasMore(rows.length >= 40);
      setMessages((prev) => [...(prev ?? []), ...rows.map(decrypt).filter((m) => !(prev ?? []).some((p) => p.id === m.id))]);
    } catch (e) {
      setError(humanError(e));
    } finally {
      setLoadingOlder(false);
    }
  };

  const submit = async () => {
    const body = text.trim();
    if (!body || !keys || !peer?.public_key) return;
    if (editing) {
      const target = editing;
      setEditing(null);
      setText('');
      try {
        upsert(await editMessage({ id: target.id, text: body, keys, peerPublicKey: peer.public_key }));
      } catch (e) {
        Alert.alert('Не удалось изменить', humanError(e));
      }
      return;
    }
    const tempId = `pending-${Date.now()}`;
    const now = new Date().toISOString();
    const optimistic: Pending = {
      id: tempId, chat_id: chatId, sender_id: myId, ciphertext: '', nonce: '', sender_key: '', recipient_key: '',
      reply_to: replyTo?.id ?? null, created_at: now, edited_at: null, deleted_at: null, text: body, pending: true,
    };
    setMessages((prev) => [optimistic, ...(prev ?? [])]);
    setText('');
    const reply = replyTo;
    setReplyTo(null);
    try {
      const row = await sendMessage({ chatId, text: body, keys, peerPublicKey: peer.public_key, replyTo: reply?.id });
      setMessages((prev) => (prev ?? []).filter((m) => m.id !== tempId && m.id !== row.id));
      upsert(row);
    } catch (e) {
      setMessages((prev) => (prev ?? []).filter((m) => m.id !== tempId));
      setText(body);
      setReplyTo(reply);
      Alert.alert('Сообщение не отправлено', humanError(e));
    }
  };

  const onLongPress = (m: Pending) => {
    if (m.pending || m.deleted_at) return;
    const own = m.sender_id === myId;
    const actions: { text: string; style?: 'cancel' | 'destructive'; onPress?: () => void }[] = [
      { text: 'Ответить', onPress: () => { setEditing(null); setReplyTo(m); } },
    ];
    if (own && m.text !== null) {
      actions.push({ text: 'Изменить', onPress: () => { setReplyTo(null); setEditing(m); setText(m.text ?? ''); } });
      actions.push({
        text: 'Удалить',
        style: 'destructive',
        onPress: () =>
          Alert.alert('Удалить сообщение?', 'Оно исчезнет у обоих собеседников.', [
            { text: 'Отмена', style: 'cancel' },
            { text: 'Удалить', style: 'destructive', onPress: () => deleteMessage(m.id).catch((e) => Alert.alert('Ошибка', humanError(e))) },
          ]),
      });
    }
    actions.push({ text: 'Отмена', style: 'cancel' });
    Alert.alert('Сообщение', undefined, actions);
  };

  const byId = useMemo(() => new Map((messages ?? []).map((m) => [m.id, m])), [messages]);

  if (messages === null && !error) return <Loading />;

  const peerName = peer?.display_name ?? 'Удалённый аккаунт';
  const status = peerTyping ? 'печатает…' : lastSeenLabel(peer?.last_seen_at);

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: c.background }}>
      <View style={{ paddingTop: insets.top + 6, paddingBottom: 10, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', backgroundColor: c.surface, borderBottomWidth: 1, borderBottomColor: c.border }}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Назад">
          <Ionicons name="chevron-back" size={26} color={c.text} />
        </Pressable>
        <Pressable
          style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginLeft: 6 }}
          onPress={() => peer && router.push({ pathname: '/user/[id]', params: { id: peer.id } })}
        >
          <Avatar name={peerName} seed={peer?.id ?? chatId} size={40} online={isOnline(peer?.last_seen_at)} />
          <View style={{ marginLeft: 10, flex: 1 }}>
            <Text style={{ color: c.text, fontSize: 16, fontWeight: '700' }} numberOfLines={1}>{peerName}</Text>
            <Text style={{ color: peerTyping || isOnline(peer?.last_seen_at) ? c.primary : c.textMuted, fontSize: 12 }}>{status}</Text>
          </View>
        </Pressable>
        <Ionicons name="lock-closed" size={16} color={c.textMuted} />
      </View>

      {error ? <ErrorBanner message={error} onRetry={load} /> : null}

      <FlatList
        inverted
        data={messages ?? []}
        keyExtractor={(m) => m.id}
        onEndReached={loadOlder}
        onEndReachedThreshold={0.3}
        contentContainerStyle={{ paddingHorizontal: 10, paddingVertical: 8 }}
        ListFooterComponent={
          loadingOlder ? (
            <ActivityIndicator color={c.primary} style={{ marginVertical: 12 }} />
          ) : !hasMore || (messages?.length ?? 0) < 40 ? (
            <View style={{ alignSelf: 'center', marginVertical: 16, paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.md, backgroundColor: c.surface, maxWidth: 300 }}>
              <Text style={{ color: c.textMuted, fontSize: 12, textAlign: 'center' }}>
                🔒 Сообщения шифруются на ваших устройствах. Сервер NEXO хранит только шифротекст.
              </Text>
            </View>
          ) : undefined
        }
        renderItem={({ item, index }) => {
          const own = item.sender_id === myId;
          const older = messages?.[index + 1];
          const newDay = !older || new Date(older.created_at).toDateString() !== new Date(item.created_at).toDateString();
          const quoted = item.reply_to ? byId.get(item.reply_to) : null;
          const read = own && !item.pending && !!peerReadAt && item.created_at <= peerReadAt;
          return (
            <View>
              {newDay ? (
                <Text style={{ alignSelf: 'center', color: c.textMuted, fontSize: 12, marginVertical: 10, backgroundColor: c.surface, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, overflow: 'hidden' }}>
                  {dayLabel(item.created_at)}
                </Text>
              ) : null}
              <Pressable onLongPress={() => onLongPress(item)} delayLongPress={300} style={{ alignItems: own ? 'flex-end' : 'flex-start', marginVertical: 2 }}>
                <View
                  style={{
                    maxWidth: '82%',
                    paddingHorizontal: 12,
                    paddingTop: 8,
                    paddingBottom: 6,
                    borderRadius: 18,
                    borderBottomRightRadius: own ? 6 : 18,
                    borderBottomLeftRadius: own ? 18 : 6,
                    backgroundColor: own ? c.bubbleOwn : c.bubbleOther,
                    opacity: item.pending ? 0.7 : 1,
                  }}
                >
                  {quoted ? (
                    <View style={{ borderLeftWidth: 3, borderLeftColor: own ? '#fff' : c.primary, paddingLeft: 8, marginBottom: 6, opacity: 0.85 }}>
                      <Text style={{ color: own ? '#fff' : c.primary, fontSize: 12, fontWeight: '700' }}>{quoted.sender_id === myId ? 'Вы' : peerName}</Text>
                      <Text style={{ color: own ? '#fff' : c.text, fontSize: 13 }} numberOfLines={1}>{quoted.deleted_at ? 'Сообщение удалено' : quoted.text ?? '🔒'}</Text>
                    </View>
                  ) : null}
                  {item.deleted_at ? (
                    <Text style={{ color: own ? 'rgba(255,255,255,0.75)' : c.textMuted, fontStyle: 'italic' }}>Сообщение удалено</Text>
                  ) : item.text === null ? (
                    <Text style={{ color: own ? 'rgba(255,255,255,0.75)' : c.textMuted, fontStyle: 'italic' }}>🔒 Не удалось расшифровать (сообщение для другого ключа)</Text>
                  ) : (
                    <Text selectable style={{ color: own ? c.bubbleOwnText : c.bubbleOtherText, fontSize: 16, lineHeight: 21 }}>{item.text}</Text>
                  )}
                  <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end', marginTop: 2, gap: 4 }}>
                    {item.edited_at && !item.deleted_at ? <Text style={{ color: own ? 'rgba(255,255,255,0.7)' : c.textMuted, fontSize: 11 }}>изм.</Text> : null}
                    <Text style={{ color: own ? 'rgba(255,255,255,0.7)' : c.textMuted, fontSize: 11 }}>{timeShort(item.created_at)}</Text>
                    {own ? (
                      <Ionicons name={item.pending ? 'time-outline' : read ? 'checkmark-done' : 'checkmark'} size={14} color={read ? '#A5F3FC' : 'rgba(255,255,255,0.75)'} />
                    ) : null}
                  </View>
                </View>
              </Pressable>
            </View>
          );
        }}
      />

      {replyTo || editing ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, backgroundColor: c.surface, borderTopWidth: 1, borderTopColor: c.border }}>
          <Ionicons name={editing ? 'create' : 'arrow-undo'} size={18} color={c.primary} />
          <View style={{ flex: 1, marginLeft: 10, borderLeftWidth: 2, borderLeftColor: c.primary, paddingLeft: 8 }}>
            <Text style={{ color: c.primary, fontSize: 12, fontWeight: '700' }}>{editing ? 'Редактирование' : `Ответ ${replyTo!.sender_id === myId ? 'себе' : peerName}`}</Text>
            <Text style={{ color: c.textMuted, fontSize: 13 }} numberOfLines={1}>{(editing ?? replyTo)!.text ?? '🔒'}</Text>
          </View>
          <Pressable
            hitSlop={10}
            onPress={() => {
              if (editing) setText('');
              setEditing(null);
              setReplyTo(null);
            }}
          >
            <Ionicons name="close" size={22} color={c.textMuted} />
          </Pressable>
        </View>
      ) : null}

      {peer && !peer.public_key ? (
        <Text style={{ color: c.textMuted, textAlign: 'center', padding: 12 }}>У собеседника нет ключа шифрования — он ещё не входил в приложение.</Text>
      ) : null}

      <View style={{ flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 10, paddingTop: 8, paddingBottom: Math.max(insets.bottom, 8), backgroundColor: c.surface, gap: 8 }}>
        <TextInput
          value={text}
          onChangeText={onChangeText}
          placeholder="Сообщение"
          placeholderTextColor={c.textMuted}
          multiline
          maxLength={MAX_MESSAGE_LENGTH}
          editable={!!peer?.public_key}
          style={{ flex: 1, minHeight: 44, maxHeight: 130, borderRadius: 22, paddingHorizontal: 16, paddingTop: 11, paddingBottom: 11, backgroundColor: c.surfaceAlt, color: c.text, fontSize: 16 }}
        />
        <Pressable
          onPress={submit}
          disabled={!text.trim() || !peer?.public_key}
          accessibilityLabel="Отправить"
          style={({ pressed }) => ({ width: 44, height: 44, borderRadius: 22, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center', opacity: !text.trim() ? 0.4 : pressed ? 0.8 : 1 })}
        >
          <Ionicons name={editing ? 'checkmark' : 'arrow-up'} size={22} color="#fff" />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
