import 'react-native-url-polyfill/auto';
import { AppState } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { secureStorage } from './secureStorage';

export interface ServerConfig {
  url: string;
  anonKey: string;
}

const CONFIG_KEY = 'nexo_server_config';

const buildTimeConfig = (): ServerConfig | null => {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  return url && anonKey ? { url, anonKey } : null;
};

export const hasBuildTimeConfig = () => buildTimeConfig() !== null;

export const loadServerConfig = async (): Promise<ServerConfig | null> => {
  const built = buildTimeConfig();
  if (built) return built;
  const raw = await SecureStore.getItemAsync(CONFIG_KEY);
  return raw ? (JSON.parse(raw) as ServerConfig) : null;
};

const isSecretKey = (key: string) => {
  if (key.startsWith('sb_secret_')) return true;
  const payload = key.split('.')[1];
  if (!payload) return false;
  try {
    const b64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const json = JSON.parse(atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4)));
    return json?.role === 'service_role';
  } catch {
    return false;
  }
};

export const normalizeUrl =(url: string) => url.trim().replace(/\/+$/, '');

// Confirms the URL is a reachable Supabase project and the key is accepted before saving it.
export const verifyServerConfig = async (cfg: ServerConfig): Promise<void> => {
  if (!/^https:\/\/[a-z0-9.-]+(:\d+)?$/i.test(cfg.url)) throw new Error('Адрес должен начинаться с https://');
  if (isSecretKey(cfg.anonKey)) throw new Error('Это секретный ключ service_role. Используйте публичный ключ anon.');
  let res: Response;
  try {
    res = await fetch(`${cfg.url}/auth/v1/settings`, { headers: { apikey: cfg.anonKey } });
  } catch {
    throw new Error('Сервер недоступен. Проверьте адрес и интернет.');
  }
  if (res.status === 401 || res.status === 403) throw new Error('Ключ не подходит к этому проекту.');
  if (!res.ok) throw new Error(`Сервер ответил ошибкой ${res.status}.`);
};

export const saveServerConfig = (cfg: ServerConfig) =>
  SecureStore.setItemAsync(CONFIG_KEY, JSON.stringify(cfg));

export const clearServerConfig = () => SecureStore.deleteItemAsync(CONFIG_KEY);

let client: SupabaseClient | null = null;

export const initSupabase = (cfg: ServerConfig): SupabaseClient => {
  client = createClient(cfg.url, cfg.anonKey, {
    auth: {
      storage: secureStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
  return client;
};

export const sb = (): SupabaseClient => {
  if (!client) throw new Error('Сервер не настроен');
  return client;
};

AppState.addEventListener('change', (state) => {
  if (!client) return;
  if (state === 'active') client.auth.startAutoRefresh();
  else client.auth.stopAutoRefresh();
});
