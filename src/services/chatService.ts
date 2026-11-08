import supabase from './supabase';
import { Chat, PrivateChat, GroupChat } from '@/types';

export class ChatService {
  async getPrivateChats(userId: string) {
    try {
      const { data, error } = await supabase
        .from('private_chats')
        .select(
          `
          id,
          created_at,
          updated_at,
          user1_id,
          user2_id,
          messages(id, content, created_at, sender_id)
        `
        )
        .or(`user1_id.eq.${userId},user2_id.eq.${userId}`);

      if (error) throw error;

      return (data as any[]) || [];
    } catch (error) {
      console.error('Error fetching private chats:', error);
      throw error;
    }
  }

  async getGroupChats(userId: string) {
    try {
      const { data, error } = await supabase
        .from('group_chat_members')
        .select(
          `
          group_chat_id,
          group_chats(
            id,
            name,
            description,
            avatar_url,
            created_by,
            created_at,
            updated_at
          )
        `
        )
        .eq('user_id', userId);

      if (error) throw error;

      return (data as any[])
        .map((item) => item.group_chats)
        .filter(Boolean);
    } catch (error) {
      console.error('Error fetching group chats:', error);
      throw error;
    }
  }

  async getAllChats(userId: string) {
    try {
      const [privateChats, groupChats] = await Promise.all([
        this.getPrivateChats(userId),
        this.getGroupChats(userId),
      ]);

      return {
        privateChats,
        groupChats,
      };
    } catch (error) {
      console.error('Error fetching all chats:', error);
      throw error;
    }
  }

  async createPrivateChat(userId1: string, userId2: string) {
    try {
      // Проверяем, не существует ли уже такой чат
      const { data: existing } = await supabase
        .from('private_chats')
        .select('id')
        .or(
          `and(user1_id.eq.${userId1},user2_id.eq.${userId2}),and(user1_id.eq.${userId2},user2_id.eq.${userId1})`
        )
        .single();

      if (existing) {
        return existing;
      }

      // Создаем новый чат
      const { data, error } = await supabase
        .from('private_chats')
        .insert({
          user1_id: userId1,
          user2_id: userId2,
        })
        .select()
        .single();

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('Error creating private chat:', error);
      throw error;
    }
  }

  async createGroupChat(
    name: string,
    description: string | null,
    createdBy: string,
    memberIds: string[]
  ) {
    try {
      // Создаем группу
      const { data: group, error: groupError } = await supabase
        .from('group_chats')
        .insert({
          name,
          description,
          created_by: createdBy,
        })
        .select()
        .single();

      if (groupError) throw groupError;

      // Добавляем членов
      const members = memberIds.map((userId) => ({
        group_chat_id: group.id,
        user_id: userId,
        is_admin: userId === createdBy,
      }));

      const { error: memberError } = await supabase
        .from('group_chat_members')
        .insert(members);

      if (memberError) throw memberError;

      return group;
    } catch (error) {
      console.error('Error creating group chat:', error);
      throw error;
    }
  }

  async getGroupMembers(groupId: string) {
    try {
      const { data, error } = await supabase
        .from('group_chat_members')
        .select(
          `
          id,
          user_id,
          is_admin,
          joined_at,
          profiles:user_id(id, full_name, username, avatar_url)
        `
        )
        .eq('group_chat_id', groupId);

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Error fetching group members:', error);
      throw error;
    }
  }

  subscribeToChat(
    chatId: string,
    isGroup: boolean,
    callback: (data: any) => void
  ) {
    const tableName = isGroup ? 'group_chats' : 'private_chats';
    const filterKey = isGroup ? 'id' : 'id';

    const subscription = supabase
      .channel(`${tableName}:${chatId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: tableName,
          filter: `${filterKey}=eq.${chatId}`,
        },
        callback
      )
      .subscribe();

    return subscription;
  }
}

export const chatService = new ChatService();
