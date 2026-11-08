import supabase from './supabase';
import { UserProfile } from '@/types';

export class UserService {
  async searchUsers(query: string, currentUserId: string, limit: number = 20) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .or(`username.ilike.%${query}%,full_name.ilike.%${query}%`)
        .neq('id', currentUserId)
        .limit(limit);

      if (error) throw error;

      return (data as UserProfile[]) || [];
    } catch (error) {
      console.error('Error searching users:', error);
      throw error;
    }
  }

  async getUserProfile(userId: string): Promise<UserProfile | null> {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      return (data as UserProfile) || null;
    } catch (error) {
      console.error('Error fetching user profile:', error);
      throw error;
    }
  }

  async getUsersByIds(userIds: string[]): Promise<UserProfile[]> {
    try {
      if (userIds.length === 0) return [];

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .in('id', userIds);

      if (error) throw error;

      return (data as UserProfile[]) || [];
    } catch (error) {
      console.error('Error fetching users:', error);
      throw error;
    }
  }

  async blockUser(userId: string, blockedUserId: string) {
    try {
      const { data, error } = await supabase
        .from('user_blocks')
        .insert({
          user_id: userId,
          blocked_user_id: blockedUserId,
        })
        .select()
        .single();

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('Error blocking user:', error);
      throw error;
    }
  }

  async unblockUser(userId: string, blockedUserId: string) {
    try {
      const { error } = await supabase
        .from('user_blocks')
        .delete()
        .eq('user_id', userId)
        .eq('blocked_user_id', blockedUserId);

      if (error) throw error;
    } catch (error) {
      console.error('Error unblocking user:', error);
      throw error;
    }
  }

  async getBlockedUsers(userId: string): Promise<UserProfile[]> {
    try {
      const { data, error } = await supabase
        .from('user_blocks')
        .select('profiles:blocked_user_id(*)')
        .eq('user_id', userId);

      if (error) throw error;

      return (data as any[])
        .map((item) => item.profiles)
        .filter(Boolean);
    } catch (error) {
      console.error('Error fetching blocked users:', error);
      throw error;
    }
  }

  async isUserBlocked(userId: string, otherUserId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('user_blocks')
        .select('id')
        .eq('user_id', userId)
        .eq('blocked_user_id', otherUserId)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      return !!data;
    } catch (error) {
      console.error('Error checking if user is blocked:', error);
      throw error;
    }
  }

  async updateOnlineStatus(userId: string, status: 'online' | 'offline' | 'away') {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          status,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);

      if (error) throw error;
    } catch (error) {
      console.error('Error updating online status:', error);
      throw error;
    }
  }

  subscribeToUserStatus(userId: string, callback: (status: string) => void) {
    const subscription = supabase
      .channel(`profiles:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${userId}`,
        },
        (payload) => {
          if (payload.new.status) {
            callback(payload.new.status);
          }
        }
      )
      .subscribe();

    return subscription;
  }
}

export const userService = new UserService();
