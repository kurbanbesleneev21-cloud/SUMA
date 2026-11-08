import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import * as Linking from 'expo-linking';
import type { Session } from '@supabase/supabase-js';
import {
  initSupabase,
  loadServerConfig,
  saveServerConfig,
  clearServerConfig,
  verifyServerConfig,
  normalizeUrl,
  ServerConfig,
  sb,
} from '@/lib/supabase';
import { loadOrCreateKeyPair } from '@/crypto/keys';
import type { KeyPair } from '@/crypto/box';
import { touchPresence } from '@/services/users';
import type { Profile } from '@/types';

interface AuthValue {
  ready: boolean;
  configured: boolean;
  session: Session | null;
  profile: Profile | null;
  keys: KeyPair | null;
  keyWasReplaced: boolean;
  passwordRecovery: boolean;
  configure: (url: string, anonKey: string) => Promise<void>;
  resetServer: () => Promise<void>;
  signUp: (p: { email: string; password: string; username: string; displayName: string }) => Promise<{ needsConfirmation: boolean }>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  finishPasswordRecovery: () => void;
  refreshProfile: () => Promise<void>;
  updateProfile: (patch: Partial<Pick<Profile, 'display_name' | 'username' | 'bio'>>) => Promise<void>;
  deleteAccount: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

const PROFILE_COLUMNS = 'id, username, display_name, bio, avatar_url, public_key, created_at';

const callbackUrl = () => Linking.createURL('auth-callback');

const parseAuthFragment = (url: string) => {
  const hash = url.includes('#') ? url.split('#')[1] : url.split('?')[1] ?? '';
  const params = new URLSearchParams(hash);
  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token');
  return access_token && refresh_token ? { access_token, refresh_token, type: params.get('type') } : null;
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [keys, setKeys] = useState<KeyPair | null>(null);
  const [keyWasReplaced, setKeyWasReplaced] = useState(false);
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  const authSub = useRef<{ unsubscribe: () => void } | null>(null);

  const start = useCallback(async (cfg: ServerConfig) => {
    const client = initSupabase(cfg);
    authSub.current?.unsubscribe();
    const { data } = client.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true);
    });
    authSub.current = data.subscription;
    const { data: current } = await client.auth.getSession();
    setSession(current.session);
    setConfigured(true);
  }, []);

  useEffect(() => {
    loadServerConfig()
      .then((cfg) => (cfg ? start(cfg) : undefined))
      .catch(() => {})
      .finally(() => setReady(true));
    return () => authSub.current?.unsubscribe();
  }, [start]);

  // Email confirmation and password reset links return here as nexo://auth-callback#access_token=...
  useEffect(() => {
    if (!configured) return;
    const handle = async (url: string | null) => {
      if (!url) return;
      const tokens = parseAuthFragment(url);
      if (!tokens) return;
      await sb().auth.setSession({ access_token: tokens.access_token, refresh_token: tokens.refresh_token });
      if (tokens.type === 'recovery') setPasswordRecovery(true);
    };
    Linking.getInitialURL().then(handle).catch(() => {});
    const sub = Linking.addEventListener('url', ({ url }) => {
      handle(url).catch(() => {});
    });
    return () => sub.remove();
  }, [configured]);

  const refreshProfile = useCallback(async () => {
    const uid = session?.user.id;
    if (!uid) return;
    const { data, error } = await sb().from('profiles').select(PROFILE_COLUMNS).eq('id', uid).single();
    if (error) throw error;
    setProfile(data as Profile);
  }, [session?.user.id]);

  // On sign-in: load this device's key pair and publish its public half.
  useEffect(() => {
    const uid = session?.user.id;
    if (!uid) {
      setProfile(null);
      setKeys(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const { keys: kp } = await loadOrCreateKeyPair(uid);
      const { data } = await sb().from('profiles').select(PROFILE_COLUMNS).eq('id', uid).single();
      let p = data as Profile | null;
      if (p && p.public_key !== kp.publicKey) {
        if (p.public_key) setKeyWasReplaced(true);
        const { data: updated } = await sb()
          .from('profiles')
          .update({ public_key: kp.publicKey })
          .eq('id', uid)
          .select(PROFILE_COLUMNS)
          .single();
        p = (updated as Profile) ?? p;
      }
      if (!cancelled) {
        setKeys(kp);
        setProfile(p);
      }
    })().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [session?.user.id]);

  // Presence heartbeat while the app is in the foreground.
  useEffect(() => {
    const uid = session?.user.id;
    if (!uid) return;
    const beat = () => {
      if (AppState.currentState !== 'active') return;
      touchPresence().catch(() => {});
    };
    beat();
    const t = setInterval(beat, 60_000);
    const sub = AppState.addEventListener('change', (s) => s === 'active' && beat());
    return () => {
      clearInterval(t);
      sub.remove();
    };
  }, [session?.user.id]);

  const value: AuthValue = {
    ready,
    configured,
    session,
    profile,
    keys,
    keyWasReplaced,
    passwordRecovery,
    configure: async (url, anonKey) => {
      const cfg = { url: normalizeUrl(url), anonKey: anonKey.trim() };
      await verifyServerConfig(cfg);
      await saveServerConfig(cfg);
      await start(cfg);
    },
    resetServer: async () => {
      await sb().auth.signOut().catch(() => {});
      await clearServerConfig();
      setSession(null);
      setConfigured(false);
    },
    signUp: async ({ email, password, username, displayName }) => {
      const { data: free, error: rpcError } = await sb().rpc('username_available', { name: username });
      if (rpcError) throw rpcError;
      if (!free) throw new Error('duplicate key username');
      const { data, error } = await sb().auth.signUp({
        email: email.trim(),
        password,
        options: { data: { username, display_name: displayName.trim() }, emailRedirectTo: callbackUrl() },
      });
      if (error) throw error;
      return { needsConfirmation: !data.session };
    },
    signIn: async (email, password) => {
      const { error } = await sb().auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
    },
    signOut: async () => {
      const { error } = await sb().auth.signOut();
      if (error) throw error;
    },
    sendPasswordReset: async (email) => {
      const { error } = await sb().auth.resetPasswordForEmail(email.trim(), { redirectTo: callbackUrl() });
      if (error) throw error;
    },
    finishPasswordRecovery: () => setPasswordRecovery(false),
    refreshProfile,
    updateProfile: async (patch) => {
      if (!session) throw new Error('not authenticated');
      const { data, error } = await sb().from('profiles').update(patch).eq('id', session.user.id).select(PROFILE_COLUMNS).single();
      if (error) throw error;
      setProfile(data as Profile);
    },
    deleteAccount: async () => {
      const { error } = await sb().rpc('delete_my_account');
      if (error) throw error;
      await sb().auth.signOut({ scope: 'local' }).catch(() => {});
      setSession(null);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth outside AuthProvider');
  return ctx;
};
