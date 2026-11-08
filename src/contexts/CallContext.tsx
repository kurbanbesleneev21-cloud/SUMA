import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Alert, PermissionsAndroid, Platform, Pressable, StyleSheet, Text, Vibration, View } from 'react-native';
import Animated, { FadeIn, FadeOut, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { useColors } from '@/contexts/ThemeContext';
import { Avatar } from '@/components/ui';
import { sb } from '@/lib/supabase';
import { answerCall, CallRow, declineCall, startCall, unwrapMediaKey } from '@/services/calls';
import { getProfile } from '@/services/users';
import { humanError } from '@/utils/errors';
import { useT } from '@/i18n';
import type { Profile } from '@/types';

interface CallValue {
  startOutgoing: (p: { chatId: string; peer: Profile; video: boolean }) => Promise<void>;
}

const CallContext = createContext<CallValue | null>(null);

export async function ensureCallPermissions(video: boolean) {
  if (Platform.OS !== 'android') return true;
  const wanted = [PermissionsAndroid.PERMISSIONS.RECORD_AUDIO, ...(video ? [PermissionsAndroid.PERMISSIONS.CAMERA] : [])];
  const res = await PermissionsAndroid.requestMultiple(wanted);
  return wanted.every((p) => res[p] === PermissionsAndroid.RESULTS.GRANTED);
}

function Pulse({ children }: { children: React.ReactNode }) {
  const c = useColors();
  const v = useSharedValue(0);
  useEffect(() => {
    v.value = withRepeat(withSequence(withTiming(1, { duration: 1100 }), withTiming(0, { duration: 0 })), -1);
  }, [v]);
  const ring = useAnimatedStyle(() => ({ opacity: 0.5 * (1 - v.value), transform: [{ scale: 1 + v.value * 0.6 }] }));
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={[{ position: 'absolute', width: 150, height: 150, borderRadius: 75, backgroundColor: c.primary }, ring]} />
      {children}
    </View>
  );
}

function IncomingCall({ call, caller, onAccept, onDecline }: { call: CallRow; caller: Profile | null; onAccept: () => void; onDecline: () => void }) {
  const c = useColors();
  const t = useT();
  const insets = useSafeAreaInsets();
  const name = caller?.display_name ?? '…';
  return (
    <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(200)} style={[StyleSheet.absoluteFill, { zIndex: 3000 }]}>
      <LinearGradient colors={[c.navy, '#090910']} style={[StyleSheet.absoluteFill, { paddingTop: insets.top + 60, paddingBottom: insets.bottom + 50, alignItems: 'center', justifyContent: 'space-between' }]}>
        <View style={{ alignItems: 'center' }}>
          <Text style={{ color: '#C4B5FD', fontSize: 15, marginBottom: 30 }}>{call.video ? t('calls.incomingVideo') : t('calls.incomingAudio')}</Text>
          <Pulse>
            <Avatar name={name} seed={caller?.id ?? call.caller_id} size={130} />
          </Pulse>
          <Text style={{ color: '#fff', fontSize: 30, fontWeight: '800', marginTop: 36 }}>{name}</Text>
          {caller ? <Text style={{ color: '#A1A1C2', marginTop: 6 }}>@{caller.username}</Text> : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14 }}>
            <Ionicons name="lock-closed" size={13} color="#38BDF8" />
            <Text style={{ color: '#A1A1C2', fontSize: 13 }}>{t('calls.e2eShort')}</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', width: '100%', justifyContent: 'space-evenly' }}>
          <View style={{ alignItems: 'center' }}>
            <Pressable onPress={onDecline} accessibilityLabel={t('calls.decline')} style={[styles.big, { backgroundColor: '#EF4444' }]}>
              <Ionicons name="call" size={32} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
            </Pressable>
            <Text style={styles.label}>{t('calls.decline')}</Text>
          </View>
          <View style={{ alignItems: 'center' }}>
            <Pressable onPress={onAccept} accessibilityLabel={t('calls.accept')} style={[styles.big, { backgroundColor: '#22C55E' }]}>
              <Ionicons name={call.video ? 'videocam' : 'call'} size={32} color="#fff" />
            </Pressable>
            <Text style={styles.label}>{t('calls.accept')}</Text>
          </View>
        </View>
      </LinearGradient>
    </Animated.View>
  );
}

export function CallProvider({ children }: { children: React.ReactNode }) {
  const t = useT();
  const router = useRouter();
  const { session, keys } = useAuth();
  const myId = session?.user.id;
  const [incoming, setIncoming] = useState<CallRow | null>(null);
  const [caller, setCaller] = useState<Profile | null>(null);
  const incomingRef = useRef<CallRow | null>(null);
  incomingRef.current = incoming;

  const stopRinging = () => Vibration.cancel();

  const show = useCallback(async (row: CallRow) => {
    if (incomingRef.current) return;
    setIncoming(row);
    Vibration.vibrate([0, 900, 700], true);
    getProfile(row.caller_id).then(setCaller).catch(() => setCaller(null));
  }, []);

  useEffect(() => {
    if (!myId) return;
    // Pick up a call that started ringing just before the app opened.
    sb()
      .from('calls')
      .select('*')
      .eq('callee_id', myId)
      .eq('status', 'ringing')
      .gt('created_at', new Date(Date.now() - 45_000).toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .then(({ data }) => data?.[0] && show(data[0] as CallRow));

    const ch = sb()
      .channel(`calls-${myId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'calls', filter: `callee_id=eq.${myId}` }, (payload) => {
        const row = payload.new as CallRow;
        if (row.status === 'ringing') show(row);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'calls', filter: `callee_id=eq.${myId}` }, (payload) => {
        const row = payload.new as CallRow;
        if (incomingRef.current?.id === row.id && row.status !== 'ringing') {
          stopRinging();
          setIncoming(null);
        }
      })
      .subscribe();
    return () => {
      stopRinging();
      sb().removeChannel(ch);
    };
  }, [myId, show]);

  const accept = async () => {
    const call = incoming;
    if (!call || !keys) return;
    stopRinging();
    setIncoming(null);
    if (!unwrapMediaKey(call, keys)) {
      Alert.alert(t('calls.cannotJoin'), t('calls.keyMismatch'));
      declineCall(call.id).catch(() => {});
      return;
    }
    if (!(await ensureCallPermissions(call.video))) {
      Alert.alert(t('calls.permissionTitle'), call.video ? t('calls.needCamMic') : t('calls.needMic'));
      declineCall(call.id).catch(() => {});
      return;
    }
    try {
      await answerCall(call.id);
      router.push({ pathname: '/call/[id]', params: { id: call.id } });
    } catch (e) {
      Alert.alert(t('calls.cannotJoin'), humanError(e));
    }
  };

  const decline = () => {
    const call = incoming;
    stopRinging();
    setIncoming(null);
    if (call) declineCall(call.id).catch(() => {});
  };

  const value: CallValue = {
    startOutgoing: async ({ chatId, peer, video }) => {
      if (!keys) return;
      if (!peer.public_key) {
        Alert.alert(t('calls.cannotCall'), t('chat.peerNoKey'));
        return;
      }
      if (!(await ensureCallPermissions(video))) {
        Alert.alert(t('calls.permissionTitle'), video ? t('calls.needCamMic') : t('calls.needMic'));
        return;
      }
      try {
        const row = await startCall({ chatId, video, keys, peerPublicKey: peer.public_key });
        if (row.status === 'busy') {
          Alert.alert(t('calls.busyTitle'), t('calls.busyText', { name: peer.display_name }));
          return;
        }
        router.push({ pathname: '/call/[id]', params: { id: row.id } });
      } catch (e) {
        Alert.alert(t('calls.cannotCall'), humanError(e));
      }
    },
  };

  return (
    <CallContext.Provider value={value}>
      {children}
      {incoming ? <IncomingCall call={incoming} caller={caller} onAccept={accept} onDecline={decline} /> : null}
    </CallContext.Provider>
  );
}

export const useCalls = () => {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error('useCalls outside CallProvider');
  return ctx;
};

const styles = StyleSheet.create({
  big: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center' },
  label: { color: '#fff', marginTop: 10, fontSize: 14 },
});
