import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useColors } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { messageService } from '@/services/messageService';
import { chatService } from '@/services/chatService';
import { userService } from '@/services/userService';
import { Message, UserProfile } from '@/types';
import supabase from '@/services/supabase';

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [otherUser, setOtherUser] = useState<UserProfile | null>(null);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (id && user) {
      loadChat();
      subscribeToMessages();
    }

    return () => {
      // Cleanup subscription
    };
  }, [id, user]);

  const loadChat = async () => {
    if (!id || !user) return;

    setLoading(true);
    try {
      // Получаем сообщения
      const msgs = await messageService.getMessages(id, null, 50);
      setMessages(msgs);

      // Получаем информацию о чате
      const { data: chatData } = await supabase
        .from('private_chats')
        .select('user1_id, user2_id')
        .eq('id', id)
        .single();

      if (chatData) {
        const otherUserId = chatData.user1_id === user.id ? chatData.user2_id : chatData.user1_id;
        const profile = await userService.getUserProfile(otherUserId);
        setOtherUser(profile);
      }
    } catch (error) {
      console.error('Error loading chat:', error);
    } finally {
      setLoading(false);
    }
  };

  const subscribeToMessages = () => {
    if (!id) return;

    const subscription = messageService.subscribeToMessages(id, null, (payload) => {
      if (payload.eventType === 'INSERT') {
        setMessages((prev) => [...prev, payload.new as Message]);
      }
    });

    return () => subscription?.unsubscribe();
  };

  const handleSendMessage = async () => {
    if (!messageText.trim() || !user || !id || !otherUser) return;

    setSending(true);
    try {
      // TODO: Получить публичный ключ получателя и зашифровать сообщение
      await messageService.sendMessage(id, null, user.id, messageText, 'text');
      setMessageText('');
      flatListRef.current?.scrollToEnd({ animated: true });
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Ошибка при отправке сообщения');
    } finally {
      setSending(false);
    }
  };

  const renderMessage = (item: Message) => {
    const isOwnMessage = item.sender_id === user?.id;

    return (
      <View
        style={{
          marginVertical: 4,
          marginHorizontal: 12,
          alignItems: isOwnMessage ? 'flex-end' : 'flex-start',
        }}
      >
        <View
          style={{
            maxWidth: '80%',
            backgroundColor: isOwnMessage ? colors.primary : colors.surface,
            borderRadius: 16,
            padding: 12,
          }}
        >
          <Text
            style={{
              color: isOwnMessage ? '#fff' : colors.text,
              fontSize: 15,
            }}
          >
            {item.content}
          </Text>
          <Text
            style={{
              color: isOwnMessage ? 'rgba(255,255,255,0.7)' : colors.textSecondary,
              fontSize: 11,
              marginTop: 4,
            }}
          >
            {new Date(item.created_at).toLocaleTimeString('ru-RU', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Заголовок */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ color: colors.primary, fontSize: 18 }}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: 'bold' }}>
            {otherUser?.full_name || 'Чат'}
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>
            {otherUser?.status === 'online' ? 'онлайн' : 'офлайн'}
          </Text>
        </View>
      </View>

      {/* Сообщения */}
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={({ item }) => renderMessage(item)}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingVertical: 8 }}
        onEndReached={() => {
          // TODO: Загрузить старые сообщения
        }}
      />

      {/* Ввод сообщения */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={[
          styles.inputContainer,
          {
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
          },
        ]}
      >
        <TextInput
          placeholder="Сообщение..."
          placeholderTextColor={colors.textSecondary}
          value={messageText}
          onChangeText={setMessageText}
          multiline
          maxLength={1000}
          editable={!sending}
          style={[
            styles.input,
            {
              backgroundColor: colors.background,
              color: colors.text,
              borderColor: colors.border,
            },
          ]}
        />
        <TouchableOpacity
          onPress={handleSendMessage}
          disabled={!messageText.trim() || sending}
          style={[
            styles.sendBtn,
            {
              backgroundColor: colors.primary,
              opacity: !messageText.trim() || sending ? 0.5 : 1,
            },
          ]}
        >
          {sending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={{ color: '#fff', fontSize: 18 }}>↑</Text>
          )}
        </TouchableOpacity>
      </KeyboardAvoidingView>
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
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 8,
    maxHeight: 100,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
