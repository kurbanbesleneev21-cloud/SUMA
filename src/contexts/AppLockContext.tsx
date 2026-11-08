import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import nacl from 'tweetnacl';
import util from 'tweetnacl-util';
import '@/crypto/keys';
import { useColors } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useT } from '@/i18n';
import { Logo, tap } from '@/components/ui';

const PIN_KEY = 'nexo_lock_pin_v1';
const PREFS_KEY = 'nexo_lock_prefs_v1';
const ITERATIONS = 20000;
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 30_000;
const opts: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };

// Slow salted hash so a copied store value does not reveal the PIN cheaply.
const derive = (pin: string, salt: Uint8Array) => {
  let h = nacl.hash(new Uint8Array([...salt, ...util.decodeUTF8(pin)]));
  for (let i = 0; i < ITERATIONS; i++) h = nacl.hash(h);
  return h.slice(0, 32);
};

const equal = (a: Uint8Array, b: Uint8Array) => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
};

export type AutoLock = 0 | 1 | 5 | 15 | 60;

interface LockPrefs {
  biometric: boolean;
  autoLockMin: AutoLock;
}

interface AppLockValue {
  pinEnabled: boolean;
  biometric: boolean;
  biometricAvailable: boolean;
  autoLockMin: AutoLock;
  setPin: (pin: string) => Promise<void>;
  removePin: () => Promise<void>;
  setBiometric: (on: boolean) => Promise<void>;
  setAutoLock: (min: AutoLock) => Promise<void>;
  verifyPin: (pin: string) => boolean;
}

const AppLockContext = createContext<AppLockValue | null>(null);

export function AppLockProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const [pinRecord, setPinRecord] = useState<string | null | undefined>(undefined);
  const [prefs, setPrefs] = useState<LockPrefs>({ biometric: false, autoLockMin: 1 });
  const [locked, setLocked] = useState(true);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const backgroundAt = useRef<number | null>(null);

  useEffect(() => {
    (async () => {
      const [pin, rawPrefs, hw, enrolled] = await Promise.all([
        SecureStore.getItemAsync(PIN_KEY, opts),
        SecureStore.getItemAsync(PREFS_KEY, opts),
        LocalAuthentication.hasHardwareAsync().catch(() => false),
        LocalAuthentication.isEnrolledAsync().catch(() => false),
      ]);
      if (rawPrefs) setPrefs(JSON.parse(rawPrefs) as LockPrefs);
      setBiometricAvailable(hw && enrolled);
      setPinRecord(pin);
      setLocked(!!pin);
    })().catch(() => setPinRecord(null));
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background') backgroundAt.current = Date.now();
      if (state === 'active' && backgroundAt.current !== null && pinRecord) {
        if (Date.now() - backgroundAt.current >= prefs.autoLockMin * 60_000) setLocked(true);
        backgroundAt.current = null;
      }
    });
    return () => sub.remove();
  }, [pinRecord, prefs.autoLockMin]);

  const savePrefs = async (next: LockPrefs) => {
    setPrefs(next);
    await SecureStore.setItemAsync(PREFS_KEY, JSON.stringify(next), opts);
  };

  const verify = useCallback(
    (pin: string) => {
      if (!pinRecord) return true;
      const [, salt, hash] = pinRecord.split('$');
      return equal(derive(pin, util.decodeBase64(salt)), util.decodeBase64(hash));
    },
    [pinRecord],
  );

  const value: AppLockValue = {
    pinEnabled: !!pinRecord,
    biometric: prefs.biometric,
    biometricAvailable,
    autoLockMin: prefs.autoLockMin,
    setPin: async (pin) => {
      const salt = nacl.randomBytes(16);
      const record = `v1$${util.encodeBase64(salt)}$${util.encodeBase64(derive(pin, salt))}`;
      await SecureStore.setItemAsync(PIN_KEY, record, opts);
      setPinRecord(record);
      setLocked(false);
    },
    removePin: async () => {
      await SecureStore.deleteItemAsync(PIN_KEY, opts);
      setPinRecord(null);
      await savePrefs({ ...prefs, biometric: false });
    },
    setBiometric: (on) => savePrefs({ ...prefs, biometric: on }),
    setAutoLock: (min) => savePrefs({ ...prefs, autoLockMin: min }),
    verifyPin: verify,
  };

  return (
    <AppLockContext.Provider value={value}>
      {children}
      {session && pinRecord && locked ? <LockScreen verify={verify} biometric={prefs.biometric && biometricAvailable} onUnlock={() => setLocked(false)} /> : null}
    </AppLockContext.Provider>
  );
}

export const useAppLock = () => {
  const ctx = useContext(AppLockContext);
  if (!ctx) throw new Error('useAppLock outside AppLockProvider');
  return ctx;
};

export function PinPad({ title, subtitle, error, onComplete, length = 4, footer }: { title: string; subtitle?: string; error?: string | null; onComplete: (pin: string) => void; length?: number; footer?: React.ReactNode }) {
  const c = useColors();
  const t = useT();
  const [pin, setPin] = useState('');
  const shake = useSharedValue(0);
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));

  useEffect(() => {
    if (!error) return;
    setPin('');
    shake.value = withSequence(withTiming(-12, { duration: 50 }), withTiming(12, { duration: 50 }), withTiming(-8, { duration: 50 }), withTiming(0, { duration: 50 }));
  }, [error, shake]);

  const press = (d: string) => {
    tap();
    const next = (pin + d).slice(0, length);
    setPin(next);
    if (next.length === length) {
      setTimeout(() => {
        onComplete(next);
        setPin('');
      }, 80);
    }
  };

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];
  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={{ color: c.text, fontSize: 22, fontWeight: '700', marginTop: 24 }}>{title}</Text>
      {subtitle ? <Text style={{ color: c.textMuted, marginTop: 6, textAlign: 'center', paddingHorizontal: 24 }}>{subtitle}</Text> : null}
      <Animated.View style={[{ flexDirection: 'row', gap: 18, marginVertical: 26 }, shakeStyle]}>
        {Array.from({ length }, (_, i) => (
          <View key={i} style={{ width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: error ? c.danger : c.primary, backgroundColor: i < pin.length ? c.primary : 'transparent' }} />
        ))}
      </Animated.View>
      <Text style={{ color: c.danger, minHeight: 20, marginBottom: 8 }}>{error ?? ''}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', width: 280, justifyContent: 'center' }}>
        {keys.map((k, i) => (
          <Pressable
            key={i}
            disabled={!k}
            onPress={() => (k === '⌫' ? setPin((p) => p.slice(0, -1)) : press(k))}
            accessibilityLabel={k === '⌫' ? t('lock.erase') : k}
            style={({ pressed }) => ({ width: 76, height: 76, margin: 8, borderRadius: 38, alignItems: 'center', justifyContent: 'center', backgroundColor: k && k !== '⌫' ? (pressed ? c.primarySoft : c.surface) : 'transparent' })}
          >
            {k === '⌫' ? <Ionicons name="backspace-outline" size={26} color={c.text} /> : <Text style={{ color: c.text, fontSize: 28, fontWeight: '500' }}>{k}</Text>}
          </Pressable>
        ))}
      </View>
      {footer}
    </View>
  );
}

function LockScreen({ verify, biometric, onUnlock }: { verify: (pin: string) => boolean; biometric: boolean; onUnlock: () => void }) {
  const c = useColors();
  const t = useT();
  const [error, setError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState(0);
  const [, force] = useState(0);

  const tryBiometric = useCallback(async () => {
    const res = await LocalAuthentication.authenticateAsync({ promptMessage: t('lock.biometricPrompt'), cancelLabel: t('common.cancel'), disableDeviceFallback: true });
    if (res.success) onUnlock();
  }, [onUnlock, t]);

  useEffect(() => {
    if (biometric) tryBiometric().catch(() => {});
  }, [biometric, tryBiometric]);

  useEffect(() => {
    if (lockedUntil <= Date.now()) return;
    const timer = setInterval(() => force((n) => n + 1), 1000);
    return () => clearInterval(timer);
  }, [lockedUntil]);

  const waitSec = Math.max(0, Math.ceil((lockedUntil - Date.now()) / 1000));

  return (
    <Animated.View entering={FadeIn.duration(150)} exiting={FadeOut.duration(200)} style={[StyleSheet.absoluteFill, { backgroundColor: c.background, zIndex: 2000, justifyContent: 'center' }]}>
      <LinearGradient colors={[c.navy, c.background]} style={StyleSheet.absoluteFill} />
      <View style={{ alignItems: 'center' }}>
        <Logo size={44} />
        {waitSec > 0 ? (
          <Text style={{ color: c.warning, marginTop: 40, textAlign: 'center', paddingHorizontal: 30 }}>{t('lock.tooMany', { sec: waitSec })}</Text>
        ) : (
          <PinPad
            title={t('lock.enterPin')}
            error={error}
            onComplete={(pin) => {
              if (verify(pin)) {
                onUnlock();
                return;
              }
              const n = attempts + 1;
              setAttempts(n);
              if (n >= MAX_ATTEMPTS) {
                setAttempts(0);
                setLockedUntil(Date.now() + LOCKOUT_MS);
              }
              setError(t('lock.wrongPin', { left: Math.max(0, MAX_ATTEMPTS - n) }));
            }}
            footer={
              biometric ? (
                <Pressable onPress={() => tryBiometric().catch(() => {})} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, padding: 10 }}>
                  <Ionicons name="finger-print" size={26} color={c.primary} />
                  <Text style={{ color: c.primary, fontWeight: '600' }}>{t('lock.useBiometric')}</Text>
                </Pressable>
              ) : null
            }
          />
        )}
      </View>
    </Animated.View>
  );
}
