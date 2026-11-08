import { sb } from '@/lib/supabase';
import type { Profile } from '@/types';

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

export const searchUsers = async (query: string, myId: string): Promise<Profile[]> => {
  const q = query.trim().replace(/^@/, '').toLowerCase();
  if (q.length < 2) return [];
  const { data, error } = await sb()
    .from('profiles')
    .select('*')
    .ilike('username', `${escapeLike(q)}%`)
    .neq('id', myId)
    .order('username')
    .limit(30);
  if (error) throw error;
  return (data ?? []) as Profile[];
};

export const getProfile = async (id: string): Promise<Profile> => {
  const { data, error } = await sb().from('profiles').select('*').eq('id', id).single();
  if (error) throw error;
  return data as Profile;
};

export const listBlocked = async (): Promise<Profile[]> => {
  const { data, error } = await sb().from('user_blocks').select('blocked:profiles!user_blocks_blocked_id_fkey(*)');
  if (error) throw error;
  return ((data ?? []) as unknown as { blocked: Profile | null }[]).map((r) => r.blocked).filter((p): p is Profile => !!p);
};

export const isBlockedByMe = async (myId: string, otherId: string): Promise<boolean> => {
  const { data } = await sb().from('user_blocks').select('blocked_id').eq('blocker_id', myId).eq('blocked_id', otherId).maybeSingle();
  return !!data;
};

export const blockUser = async (myId: string, otherId: string) => {
  const { error } = await sb().from('user_blocks').insert({ blocker_id: myId, blocked_id: otherId });
  if (error && !/duplicate/i.test(error.message)) throw error;
};

export const unblockUser = async (myId: string, otherId: string) => {
  const { error } = await sb().from('user_blocks').delete().eq('blocker_id', myId).eq('blocked_id', otherId);
  if (error) throw error;
};
