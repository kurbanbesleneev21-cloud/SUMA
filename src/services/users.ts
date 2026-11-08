import { sb } from '@/lib/supabase';
import type { Presence } from '@/utils/format';
import type { Profile, UserSettings } from '@/types';

const PROFILE_COLUMNS = 'id, username, display_name, bio, avatar_url, public_key, created_at';
const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

export const searchUsers = async (query: string, myId: string): Promise<Profile[]> => {
  const q = query.trim().replace(/^@/, '').toLowerCase();
  if (q.length < 2) return [];
  const { data, error } = await sb()
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .ilike('username', `${escapeLike(q)}%`)
    .neq('id', myId)
    .order('username')
    .limit(30);
  if (error) throw error;
  return (data ?? []) as Profile[];
};

export const getProfile = async (id: string): Promise<Profile> => {
  const { data, error } = await sb().from('profiles').select(PROFILE_COLUMNS).eq('id', id).single();
  if (error) throw error;
  return data as Profile;
};

export const getPresence = async (ids: string[]): Promise<Record<string, Presence>> => {
  if (!ids.length) return {};
  const { data, error } = await sb().rpc('get_presence', { ids });
  if (error) throw error;
  const map: Record<string, Presence> = {};
  for (const row of (data ?? []) as (Presence & { user_id: string })[]) map[row.user_id] = { is_online: row.is_online, last_seen_at: row.last_seen_at };
  return map;
};

export const touchPresence = async () => {
  await sb().rpc('touch_presence');
};

export const listContacts = async (): Promise<Profile[]> => {
  const { data, error } = await sb()
    .from('contacts')
    .select(`contact:profiles!contacts_contact_id_fkey(${PROFILE_COLUMNS})`)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as { contact: Profile | null }[])
    .map((r) => r.contact)
    .filter((p): p is Profile => !!p)
    .sort((a, b) => a.display_name.localeCompare(b.display_name));
};

export const isContact = async (myId: string, otherId: string): Promise<boolean> => {
  const { data } = await sb().from('contacts').select('contact_id').eq('owner_id', myId).eq('contact_id', otherId).maybeSingle();
  return !!data;
};

export const addContact = async (myId: string, otherId: string) => {
  const { error } = await sb().from('contacts').insert({ owner_id: myId, contact_id: otherId });
  if (error && !/duplicate/i.test(error.message)) throw error;
};

export const removeContact = async (myId: string, otherId: string) => {
  const { error } = await sb().from('contacts').delete().eq('owner_id', myId).eq('contact_id', otherId);
  if (error) throw error;
};

export const listBlocked = async (): Promise<Profile[]> => {
  const { data, error } = await sb().from('user_blocks').select(`blocked:profiles!user_blocks_blocked_id_fkey(${PROFILE_COLUMNS})`);
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

export const getSettings = async (): Promise<UserSettings> => {
  const { data, error } = await sb().from('user_settings').select('*').single();
  if (error) throw error;
  return data as UserSettings;
};

export const updateSettings = async (userId: string, patch: Partial<Omit<UserSettings, 'user_id'>>): Promise<UserSettings> => {
  const { data, error } = await sb()
    .from('user_settings')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .select('*')
    .single();
  if (error) throw error;
  return data as UserSettings;
};
