import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, FlatList, KeyboardAvoidingView, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeInUp, LinearTransition } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { useColors, useTheme } from '@/contexts/ThemeContext';
import { ActionSheet, Avatar, ErrorBanner, Loading, SheetAction, tap } from '@/components/ui';
import { usePresence } from '@/components/PeopleList';
import { sb } from '@/lib/supabase';
import { secureStorage } from '@/lib/secureStorage';
import {
  clearChatForMe,
  decryptRow,
  deleteMessage,
  editMessage,
  fetchChatPeer,
  fetchMessages,
  fetchPeerReadAt,
  isMuted,
  markChatRead,
  MAX_MESSAGE_LENGTH,
  sendMessage,
  setChatPrefs,
} from '@/services/chats';
import { getProfile } from '@/services/users';
import { dayLabel, presenceLabel, timeShort } from '@/utils/format';
import { humanError } from '@/utils/errors';
import { useT } from '@/i18n';
import type { DecryptedMessage, MessageRow, Profile } from '@/types';
import { radius } from '@/constants/theme';

type Pending = DecryptedMessage & { pending?: boolean };
const draftKey = (chatId: string) => `nexo_draft_${chatId}`;

export default function ChatScreen() {
  const c = useColors();
  const t = useT();
  const { fs, animations } = useTheme();
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
  const [mutedUntil, setMutedUntil] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [msgMenu, setMsgMenu] = useState<Pending | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const typingChannel = useRef<ReturnType<ReturnType<typeof sb>['channel']> | null>(null);
  const lastTypingSent = useRef(0);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const presence = usePresence(peer ? [peer.id] : [])[peer?.id ?? ''];

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
      const [rows, p, readAt, prefs] = await Promise.all([
        fetchMessages(chatId),
        peerId ? getProfile(peerId) : Promise.resolve(null),
        peerId ? fetchPeerReadAt(chatId, peerId) : Promise.resolve(null),
        sb().from('chat_prefs').select('muted_until').eq('chat_id', chatId).maybeSingle(),
      ]);
      setPeer(p);
      setPeerReadAt(readAt);
      setMutedUntil((prefs.data?.muted_until as string | null | undefined) ?? null);
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

  // Drafts survive leaving the chat and restarting the app; stored encrypted at rest by the OS keystore.
  useEffect(() => {
    secureStorage.getItem(draftKey(chatId)).then((d) => d && setText((cur) => cur || d)).catch(() => {});
  }, [chatId]);
  useEffect(() => {
    if (editing) return;
    const timer = setTimeout(() => {
      (text.trim() ? secureStorage.setItem(draftKey(chatId), text) : secureStorage.removeItem(draftKey(chatId))).catch(() => {});
    }, 500);
    return () => clearTimeout(timer);
  }, [text, chatId, editing]);

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
        const row = payload.new as { user_id: string };
        if (row.user_id !== myId) fetchPeerReadAt(chatId, row.user_id).then(setPeerReadAt).catch(() => {});
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

  const onChangeText = (v: string) => {
    setText(v);
    const now = Date.now();
    if (v && now - lastTypingSent.current > 2000) {
      lastTypingSent.current = now;
      typingChannel.current?.send({ type: 'broadcast', event: 'typing', payload: { user: myId } }).catch(() => {});
    }
  };

  const loadOlder = async () => {
    if (!messages?.length || loadingOlder || !hasMore || searching) return;
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
    tap();
    if (editing) {
      const target = editing;
      setEditing(null);
      setText('');
      try {
        upsert(await editMessage({ id: target.id, text: body, keys, peerPublicKey: peer.public_key }));
      } catch (e) {
        Alert.alert(t('chat.editFailed'), humanError(e));
      }
      return;
    }
    const tempId = `pending-${Date.now()}`;
    const optimistic: Pending = {
      id: tempId, chat_id: chatId, sender_id: myId, ciphertext: '', nonce: '', sender_key: '', recipient_key: '',
      reply_to: replyTo?.id ?? null, created_at: new Date().toISOString(), edited_at: null, deleted_at: null, text: body, pending: true,
    };
    setMessages((prev) => [optimistic, ...(prev ?? [])]);
    setText('');
    secureStorage.removeItem(draftKey(chatId)).catch(() => {});
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
      Alert.alert(t('chat.sendFailed'), humanError(e));
    }
  };

  const messageActions = (m: Pending): SheetAction[] => {
    const own = m.sender_id === myId;
    const list: SheetAction[] = [{ label: t('chat.reply'), icon: 'arrow-undo', onPress: () => { setEditing(null); setReplyTo(m); } }];
    if (m.text) list.push({ label: t('chat.copy'), icon: 'copy', onPress: () => Clipboard.setStringAsync(m.text ?? '').catch(() => {}) });
    if (own && m.text !== null) {
      list.push({ label: t('chat.edit'), icon: 'create', onPress: () => { setReplyTo(null); setEditing(m); setText(m.text ?? ''); } });
      list.push({
        label: t('chat.deleteForAll'),
        icon: 'trash',
        danger: true,
        onPress: () =>
          Alert.alert(t('chat.deleteTitle'), t('chat.deleteText'), [
            { text: t('common.cancel'), style: 'cancel' },
            { text: t('common.delete'), style: 'destructive', onPress: () => deleteMessage(m.id).catch((e) => Alert.alert(t('common.error'), humanError(e))) },
          ]),
      });
    }
    return list;
  };

  const muted = isMuted(mutedUntil);
  const headerActions: SheetAction[] = [
    ...(peer ? [{ label: t('chat.viewProfile'), icon: 'person-circle' as const, onPress: () => router.push({ pathname: '/user/[id]', params: { id: peer.id } }) }] : []),
    { label: t('chat.searchInChat'), icon: 'search', onPress: () => setSearching(true) },
    {
      label: muted ? t('chats.unmute') : t('chats.muteForever'),
      icon: muted ? 'volume-high' : 'volume-mute',
      onPress: () => {
        const until = muted ? null : new Date('2999-01-01T00:00:00Z');
        setMutedUntil(until ? until.toISOString() : null);
        setChatPrefs(chatId, { mutedUntil: until }).catch((e) => Alert.alert(t('common.error'), humanError(e)));
      },
    },
    {
      label: t('chats.deleteForMe'),
      icon: 'trash',
      danger: true,
      onPress: () =>
        Alert.alert(t('chats.deleteTitle'), t('chats.deleteText'), [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('common.delete'), style: 'destructive', onPress: () => clearChatForMe(chatId).then(() => router.back()).catch((e) => Alert.alert(t('common.error'), humanError(e))) },
        ]),
    },
  ];

  const byId = useMemo(() => new Map((messages ?? []).map((m) => [m.id, m])), [messages]);
  const shown = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!searching || !q) return messages ?? [];
    return (messages ?? []).filter((m) => m.text?.toLowerCase().includes(q));
  }, [messages, searching, searchQuery]);

  if (messages === null && !error) return <Loading />;

  const peerName = peer?.display_name ?? t('chats.deletedAccount');
  const status = peerTyping ? t('chat.typing') : presenceLabel(presence);
  const statusActive = peerTyping || !!presence?.is_online;

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: c.background }}>
      <View style={{ paddingTop: insets.top + 6, paddingBottom: 10, paddingHorizontal: 10, backgroundColor: c.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border }}>
        {searching ? (
          <Animated.View entering={FadeIn} style={{ flexDirection: 'row', alignItems: 'center', height: 44 }}>
            <Ionicons name="search" size={20} color={c.textMuted} style={{ marginHorizontal: 8 }} />
            <TextInput
              autoFocus
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={t('chat.searchPlaceholder')}
              placeholderTextColor={c.textMuted}
              style={{ flex: 1, color: c.text, fontSize: 16 }}
            />
            <Pressable hitSlop={10} onPress={() => { setSearching(false); setSearchQuery(''); }}>
              <Text style={{ color: c.primary, fontWeight: '600', marginHorizontal: 8 }}>{t('common.done')}</Text>
            </Pressable>
          </Animated.View>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel={t('common.back')} style={{ padding: 4 }}>
              <Ionicons name="chevron-back" size={26} color={c.text} />
            </Pressable>
            <Pressable style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginLeft: 4 }} onPress={() => peer && router.push({ pathname: '/user/[id]', params: { id: peer.id } })}>
              <Avatar name={peerName} seed={peer?.id ?? chatId} size={42} online={presence?.is_online} />
              <View style={{ marginLeft: 10, flex: 1 }}>
                <Text style={{ color: c.text, fontSize: 16, fontWeight: '700' }} numberOfLines={1}>
                  {peerName}
                </Text>
                <Text style={{ color: statusActive ? c.primary : c.textMuted, fontSize: 12 }}>{status}</Text>
              </View>
            </Pressable>
            <Pressable onPress={() => setMenuOpen(true)} hitSlop={10} accessibilityLabel={t('chat.menu')} style={{ padding: 6 }}>
              <Ionicons name="ellipsis-vertical" size={22} color={c.text} />
            </Pressable>
          </View>
        )}
      </View>

      {error ? <ErrorBanner message={error} onRetry={load} /> : null}

      <FlatList
        inverted
        data={shown}
        keyExtractor={(m) => m.id}
        onEndReached={loadOlder}
        onEndReachedThreshold={0.3}
        contentContainerStyle={{ paddingHorizontal: 10, paddingVertical: 8, flexGrow: 1 }}
        ListEmptyComponent={
          searching && searchQuery ? (
            <Text style={{ color: c.textMuted, textAlign: 'center', marginTop: 40, transform: [{ scaleY: -1 }] }}>{t('chat.searchNothing')}</Text>
          ) : undefined
        }
        ListFooterComponent={
          loadingOlder ? (
            <ActivityIndicator color={c.primary} style={{ marginVertical: 12 }} />
          ) : !hasMore || (messages?.length ?? 0) < 40 ? (
            <View style={{ alignSelf: 'center', marginVertical: 16, paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.md, backgroundColor: c.surface, maxWidth: 300, flexDirection: 'row', gap: 8 }}>
              <Ionicons name="lock-closed" size={14} color={c.neon} style={{ marginTop: 1 }} />
              <Text style={{ color: c.textMuted, fontSize: 12, flex: 1 }}>{t('chat.encryptedNotice')}</Text>
            </View>
          ) : undefined
        }
        renderItem={({ item, index }) => {
          const own = item.sender_id === myId;
          const older = shown[index + 1];
          const newDay = !older || new Date(older.created_at).toDateString() !== new Date(item.created_at).toDateString();
          const quoted = item.reply_to ? byId.get(item.reply_to) : null;
          const read = own && !item.pending && !!peerReadAt && item.created_at <= peerReadAt;
          const meta = own ? 'rgba(255,255,255,0.75)' : c.textMuted;
          const body = (
            <>
              {quoted ? (
                <View style={{ borderLeftWidth: 3, borderLeftColor: own ? '#fff' : c.primary, paddingLeft: 8, marginBottom: 6, opacity: 0.9 }}>
                  <Text style={{ color: own ? '#fff' : c.primary, fontSize: 12, fontWeight: '700' }}>{quoted.sender_id === myId ? t('chats.you') : peerName}</Text>
                  <Text style={{ color: own ? '#fff' : c.text, fontSize: 13 }} numberOfLines={1}>{quoted.deleted_at ? t('chat.deleted') : quoted.text ?? '🔒'}</Text>
                </View>
              ) : null}
              {item.deleted_at ? (
                <Text style={{ color: meta, fontStyle: 'italic', fontSize: fs(15) }}>{t('chat.deleted')}</Text>
              ) : item.text === null ? (
                <Text style={{ color: meta, fontStyle: 'italic', fontSize: fs(15) }}>🔒 {t('chat.cannotDecrypt')}</Text>
              ) : (
                <Text selectable style={{ color: own ? c.bubbleOwnText : c.bubbleOtherText, fontSize: fs(16), lineHeight: fs(21) }}>{item.text}</Text>
              )}
              <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end', marginTop: 2, gap: 4 }}>
                {item.edited_at && !item.deleted_at ? <Text style={{ color: meta, fontSize: 11 }}>{t('chat.edited')}</Text> : null}
                <Text style={{ color: meta, fontSize: 11 }}>{timeShort(item.created_at)}</Text>
                {own ? <Ionicons name={item.pending ? 'time-outline' : read ? 'checkmark-done' : 'checkmark'} size={14} color={read ? '#A5F3FC' : meta} /> : null}
              </View>
            </>
          );
          const bubble = {
            maxWidth: '82%' as const,
            paddingHorizontal: 12,
            paddingTop: 8,
            paddingBottom: 6,
            borderRadius: 20,
            borderBottomRightRadius: own ? 6 : 20,
            borderBottomLeftRadius: own ? 20 : 6,
            opacity: item.pending ? 0.7 : 1,
          };
          return (
            <Animated.View entering={animations && index < 3 ? FadeInUp.duration(220) : undefined} layout={animations ? LinearTransition.duration(180) : undefined}>
              {newDay ? (
                <Text style={{ alignSelf: 'center', color: c.textMuted, fontSize: 12, marginVertical: 10, backgroundColor: c.surface, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 10, overflow: 'hidden' }}>{dayLabel(item.created_at)}</Text>
              ) : null}
              <Pressable
                onLongPress={() => {
                  if (item.pending || item.deleted_at) return;
                  tap();
                  setMsgMenu(item);
                }}
                delayLongPress={280}
                style={{ alignItems: own ? 'flex-end' : 'flex-start', marginVertical: 2 }}
              >
                {own ? (
                  <LinearGradient colors={[c.gradient[0], c.gradient[2]]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={bubble}>
                    {body}
                  </LinearGradient>
                ) : (
                  <View style={[bubble, { backgroundColor: c.bubbleOther, borderWidth: StyleSheet.hairlineWidth, borderColor: c.border }]}>{body}</View>
                )}
              </Pressable>
            </Animated.View>
          );
        }}
      />

      {replyTo || editing ? (
        <Animated.View entering={FadeIn} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, backgroundColor: c.surface, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border }}>
          <Ionicons name={editing ? 'create' : 'arrow-undo'} size={18} color={c.primary} />
          <View style={{ flex: 1, marginLeft: 10, borderLeftWidth: 2, borderLeftColor: c.primary, paddingLeft: 8 }}>
            <Text style={{ color: c.primary, fontSize: 12, fontWeight: '700' }}>{editing ? t('chat.editing') : t('chat.replyTo', { name: replyTo!.sender_id === myId ? t('chats.you') : peerName })}</Text>
            <Text style={{ color: c.textMuted, fontSize: 13 }} numberOfLines={1}>{(editing ?? replyTo)!.text ?? '🔒'}</Text>
          </View>
          <Pressable hitSlop={10} onPress={() => { if (editing) setText(''); setEditing(null); setReplyTo(null); }}>
            <Ionicons name="close" size={22} color={c.textMuted} />
          </Pressable>
        </Animated.View>
      ) : null}

      {peer && !peer.public_key ? <Text style={{ color: c.textMuted, textAlign: 'center', padding: 12 }}>{t('chat.peerNoKey')}</Text> : null}

      <View style={{ flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 10, paddingTop: 8, paddingBottom: Math.max(insets.bottom, 8), backgroundColor: c.surface, gap: 8 }}>
        <TextInput
          value={text}
          onChangeText={onChangeText}
          placeholder={t('chat.placeholder')}
          placeholderTextColor={c.textMuted}
          multiline
          maxLength={MAX_MESSAGE_LENGTH}
          editable={!!peer?.public_key}
          style={{ flex: 1, minHeight: 44, maxHeight: 130, borderRadius: 22, paddingHorizontal: 16, paddingTop: 11, paddingBottom: 11, backgroundColor: c.surfaceAlt, color: c.text, fontSize: fs(16) }}
        />
        <Pressable onPress={submit} disabled={!text.trim() || !peer?.public_key} accessibilityLabel={t('chat.send')} style={{ opacity: !text.trim() ? 0.4 : 1 }}>
          <LinearGradient colors={c.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name={editing ? 'checkmark' : 'arrow-up'} size={22} color="#fff" />
          </LinearGradient>
        </Pressable>
      </View>

      <ActionSheet visible={menuOpen} title={peerName} actions={headerActions} onClose={() => setMenuOpen(false)} />
      <ActionSheet visible={!!msgMenu} actions={msgMenu ? messageActions(msgMenu) : []} onClose={() => setMsgMenu(null)} />
    </KeyboardAvoidingView>
  );
}
