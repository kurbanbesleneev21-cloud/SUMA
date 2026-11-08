import supabase from './supabase';
import { cryptoService } from './crypto';
import { Message } from '@/types';

export class MessageService {
  async sendMessage(
    chatId: string | null,
    groupChatId: string | null,
    senderId: string,
    content: string,
    messageType: 'text' | 'image' | 'video' | 'audio' | 'file' = 'text',
    recipientPublicKey?: Uint8Array
  ) {
    try {
      let encryptedData: { ciphertext: string; nonce: string } | null = null;

      // Шифруем сообщение, если есть публичный ключ получателя
      if (recipientPublicKey) {
        encryptedData = cryptoService.encryptMessage(content, recipientPublicKey);
      }

      const { data, error } = await supabase
        .from('messages')
        .insert({
          chat_id: chatId,
          group_chat_id: groupChatId,
          sender_id: senderId,
          content,
          encrypted_content: encryptedData?.ciphertext,
          message_type: messageType,
        })
        .select()
        .single();

      if (error) throw error;

      // Если есть зашифрованные данные, сохраняем информацию о шифровании
      if (encryptedData && data) {
        // TODO: Сохранить информацию о nonce где-то (в metadata или отдельной таблице)
      }

      return data;
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }

  async getMessages(
    chatId?: string,
    groupChatId?: string,
    limit: number = 50
  ): Promise<Message[]> {
    try {
      let query = supabase
        .from('messages')
        .select(
          `
          id,
          chat_id,
          group_chat_id,
          sender_id,
          content,
          encrypted_content,
          message_type,
          is_edited,
          created_at,
          updated_at,
          deleted_at,
          reply_to_id,
          profiles:sender_id(id, full_name, username, avatar_url)
        `
        )
        .order('created_at', { ascending: true })
        .limit(limit);

      if (chatId) {
        query = query.eq('chat_id', chatId);
      } else if (groupChatId) {
        query = query.eq('group_chat_id', groupChatId);
      }

      const { data, error } = await query;

      if (error) throw error;

      return (data as any[]) || [];
    } catch (error) {
      console.error('Error fetching messages:', error);
      throw error;
    }
  }

  async editMessage(messageId: string, newContent: string) {
    try {
      const { data, error } = await supabase
        .from('messages')
        .update({
          content: newContent,
          is_edited: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', messageId)
        .select()
        .single();

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('Error editing message:', error);
      throw error;
    }
  }

  async deleteMessage(messageId: string) {
    try {
      const { data, error } = await supabase
        .from('messages')
        .update({
          deleted_at: new Date().toISOString(),
        })
        .eq('id', messageId)
        .select()
        .single();

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('Error deleting message:', error);
      throw error;
    }
  }

  async addReaction(messageId: string, userId: string, emoji: string) {
    try {
      const { data, error } = await supabase
        .from('message_reactions')
        .insert({
          message_id: messageId,
          user_id: userId,
          emoji,
        })
        .select()
        .single();

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('Error adding reaction:', error);
      throw error;
    }
  }

  async markAsRead(messageId: string, userId: string) {
    try {
      const { data, error } = await supabase
        .from('message_reads')
        .insert({
          message_id: messageId,
          user_id: userId,
        })
        .select()
        .single();

      if (error && !error.message.includes('duplicate')) throw error;

      return data;
    } catch (error) {
      console.error('Error marking message as read:', error);
      // Не выбрасываем ошибку, так как это может быть дубликат
    }
  }

  subscribeToMessages(
    chatId: string | null,
    groupChatId: string | null,
    callback: (data: any) => void
  ) {
    const filter = chatId
      ? `chat_id=eq.${chatId}`
      : `group_chat_id=eq.${groupChatId}`;

    const subscription = supabase
      .channel(`messages:${chatId || groupChatId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter,
        },
        callback
      )
      .subscribe();

    return subscription;
  }

  async uploadFile(
    fileName: string,
    fileData: Uint8Array,
    bucket: string = 'messages'
  ) {
    try {
      // Генерируем уникальное имя файла
      const timestamp = Date.now();
      const uniquePath = `${timestamp}-${fileName}`;

      // Шифруем файл
      const symmetricKey = cryptoService.generateSymmetricKey();
      const encrypted = cryptoService.encryptFile(fileData, symmetricKey);

      // Загружаем зашифрованный файл
      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(uniquePath, Buffer.from(encrypted.ciphertext, 'base64'));

      if (error) throw error;

      return {
        path: data.path,
        symmetricKey: cryptoService.encodeBase64(symmetricKey),
        nonce: encrypted.nonce,
      };
    } catch (error) {
      console.error('Error uploading file:', error);
      throw error;
    }
  }

  async downloadFile(path: string, symmetricKey: string, nonce: string) {
    try {
      const { data, error } = await supabase.storage
        .from('messages')
        .download(path);

      if (error) throw error;

      const encryptedData = new Uint8Array(await data!.arrayBuffer());
      const key = cryptoService.decodeBase64(symmetricKey);

      const decrypted = cryptoService.decryptFile(
        Buffer.from(encryptedData).toString('base64'),
        nonce,
        key
      );

      return decrypted;
    } catch (error) {
      console.error('Error downloading file:', error);
      throw error;
    }
  }
}

export const messageService = new MessageService();
