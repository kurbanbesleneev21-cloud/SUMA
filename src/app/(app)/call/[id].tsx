import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useKeepAwake } from 'expo-keep-awake';
import NetInfo from '@react-native-community/netinfo';
import { AudioSession, RNE2EEManager, RNKeyProvider, VideoTrack, RoomContext, useTracks, isTrackReference } from '@livekit/react-native';
import { ConnectionState, LocalVideoTrack, Room, RoomEvent, Track } from 'livekit-client';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar } from '@/components/ui';
import { sb } from '@/lib/supabase';
import { CallRow, CallTokenError, endCall, fetchCallToken, getCall, markPresence, mediaKeyFor, RING_TIMEOUT_MS, unwrapMediaKey } from '@/services/calls';
import { getProfile } from '@/services/users';
import { formatDuration } from '@/services/attachments';
import { humanError } from '@/utils/errors';
import { useT, TKey } from '@/i18n';
import type { Profile } from '@/types';

type Phase = 'preparing' | 'ringing' | 'connecting' | 'active' | 'reconnecting' | 'ended';

const endReasons: Record<string, TKey> = {
  declined: 'calls.reasonDeclined',
  missed: 'calls.reasonNoAnswer',
  busy: 'calls.reasonBusy',
  cancelled: 'calls.reasonCancelled',
  ended: 'calls.reasonEnded',
  failed: 'calls.reasonFailed',
};

function CtrlButton({ icon, label, active, danger, onPress }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; active?: boolean; danger?: boolean; onPress: () => void }) {
  return (
    <View style={{ alignItems: 'center', width: 76 }}>
      <Pressable onPress={onPress} accessibilityLabel={label} style={{ width: 62, height: 62, borderRadius: 31, alignItems: 'center', justifyContent: 'center', backgroundColor: danger ? '#EF4444' : active ? '#fff' : 'rgba(255,255,255,0.16)' }}>
        <Ionicons name={icon} size={27} color={danger ? '#fff' : active ? '#111' : '#fff'} style={danger ? { transform: [{ rotate: '135deg' }] } : undefined} />
      </Pressable>
      <Text style={{ color: '#E5E7EB', fontSize: 11, marginTop: 6, textAlign: 'center' }} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function VideoStage({ peer, localOn }: { peer: Profile | null; localOn: boolean }) {
  const { width, height } = useWindowDimensions();
  const tracks = useTracks([Track.Source.Camera], { onlySubscribed: false });
  const remote = tracks.find((tr) => isTrackReference(tr) && !tr.participant.isLocal && !tr.publication.isMuted);
  const local = tracks.find((tr) => isTrackReference(tr) && tr.participant.isLocal);
  const landscape = width > height;
  return (
    <>
      {remote && isTrackReference(remote) ? (
        <VideoTrack trackRef={remote} style={StyleSheet.absoluteFill} objectFit="cover" />
      ) : (
        <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
          <Avatar name={peer?.display_name ?? '?'} seed={peer?.id ?? 'peer'} size={120} />
        </View>
      )}
      {localOn && local && isTrackReference(local) ? (
        <View style={{ position: 'absolute', top: 100, right: 16, width: landscape ? 180 : 110, height: landscape ? 110 : 160, borderRadius: 16, overflow: 'hidden', borderWidth: 2, borderColor: 'rgba(255,255,255,0.35)', backgroundColor: '#111' }}>
          <VideoTrack trackRef={local} style={{ flex: 1 }} objectFit="cover" mirror />
        </View>
      ) : null}
    </>
  );
}

export default function CallScreen() {
  useKeepAwake();
  const t = useT();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session, keys } = useAuth();
  const myId = session!.user.id;

  const [call, setCall] = useState<CallRow | null>(null);
  const [peer, setPeer] = useState<Profile | null>(null);
  const [phase, setPhase] = useState<Phase>('preparing');
  const [endText, setEndText] = useState<string | null>(null);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(false);
  const [speaker, setSpeaker] = useState(false);
  const [offline, setOffline] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [encrypted, setEncrypted] = useState(false);

  const keyProvider = useMemo(() => new RNKeyProvider({}), []);
  const room = useMemo(() => new Room({ adaptiveStream: true, dynacast: true, encryption: { e2eeManager: new RNE2EEManager(keyProvider) } }), [keyProvider]);
  const finished = useRef(false);
  const joined = useRef(false);

  const finish = useCallback(
    async (reasonKey: TKey | null, opts: { notifyServer?: boolean; timedOut?: boolean } = {}) => {
      if (finished.current) return;
      finished.current = true;
      setPhase('ended');
      setEndText(reasonKey ? t(reasonKey) : null);
      if (opts.notifyServer) await endCall(id, opts.timedOut).catch(() => {});
      if (joined.current) markPresence(id, false).catch(() => {});
      await room.disconnect().catch(() => {});
      await AudioSession.stopAudioSession().catch(() => {});
      setTimeout(() => router.back(), 1600);
    },
    [id, room, router, t],
  );

  const join = useCallback(
    async (row: CallRow) => {
      if (joined.current || finished.current || !keys) return;
      joined.current = true;
      setPhase((p) => (p === 'ringing' ? 'ringing' : 'connecting'));
      const mediaKey = mediaKeyFor(row.id) ?? (row.callee_id === myId ? unwrapMediaKey(row, keys) : null);
      if (!mediaKey) return finish('calls.keyMismatchShort', { notifyServer: true });
      try {
        const { url, token } = await fetchCallToken(row.id);
        await keyProvider.setSharedKey(mediaKey);
        await room.setE2EEEnabled(true);
        await AudioSession.configureAudio({ android: { preferredOutputList: row.video ? ['speaker'] : ['earpiece'], audioTypeOptions: { manageAudioFocus: true, audioMode: 'inCommunication', audioFocusMode: 'gain', audioStreamType: 'voiceCall', audioAttributesUsageType: 'voiceCommunication', audioAttributesContentType: 'speech' } }, ios: { defaultOutput: row.video ? 'speaker' : 'earpiece' } });
        await AudioSession.startAudioSession();
        await room.connect(url, token);
        await room.localParticipant.setMicrophoneEnabled(true);
        if (row.video) {
          await room.localParticipant.setCameraEnabled(true);
          setCamOn(true);
          setSpeaker(true);
        }
        markPresence(row.id, true).catch(() => {});
        setEncrypted(room.isE2EEEnabled);
      } catch (e) {
        const code = e instanceof CallTokenError ? e.code : '';
        finish(code === 'livekit_not_configured' ? 'calls.notConfigured' : code === 'call_not_active' ? 'calls.reasonEnded' : 'calls.reasonFailed', { notifyServer: true });
        if (!(e instanceof CallTokenError)) console.warn('call join failed', humanError(e));
      }
    },
    [finish, keyProvider, keys, myId, room],
  );

  // Load call, react to status changes from the other side.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const row = await getCall(id);
        if (!alive) return;
        setCall(row);
        const other = row.caller_id === myId ? row.callee_id : row.caller_id;
        getProfile(other).then(setPeer).catch(() => {});
        if (row.status === 'ringing' && row.caller_id === myId) {
          setPhase('ringing');
          join(row);
        } else if (row.status === 'active') {
          join(row);
        } else {
          finish(endReasons[row.status] ?? 'calls.reasonEnded');
        }
      } catch {
        finish('calls.reasonFailed');
      }
    })();
    const ch = sb()
      .channel(`call-${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'calls', filter: `id=eq.${id}` }, (payload) => {
        const row = payload.new as CallRow;
        setCall(row);
        if (row.status === 'active') setPhase((p) => (p === 'ringing' ? 'connecting' : p));
        else if (row.status !== 'ringing') finish(endReasons[row.status] ?? 'calls.reasonEnded');
      })
      .subscribe();
    return () => {
      alive = false;
      sb().removeChannel(ch);
    };
  }, [id, myId, join, finish]);

  // No answer within the ring timeout.
  useEffect(() => {
    if (phase !== 'ringing' || !call) return;
    const left = RING_TIMEOUT_MS - (Date.now() - new Date(call.created_at).getTime());
    const timer = setTimeout(() => finish('calls.reasonNoAnswer', { notifyServer: true, timedOut: true }), Math.max(0, left));
    return () => clearTimeout(timer);
  }, [phase, call, finish]);

  // Media connection state.
  useEffect(() => {
    const onState = (state: ConnectionState) => {
      if (state === ConnectionState.Reconnecting || state === ConnectionState.SignalReconnecting) setPhase('reconnecting');
      if (state === ConnectionState.Connected) setPhase((p) => (p === 'ringing' ? 'ringing' : 'active'));
    };
    const onDisconnected = () => {
      if (!finished.current) finish('calls.reasonLost', { notifyServer: true });
    };
    const onParticipantLeft = () => {
      if (!finished.current && call?.status === 'active') finish('calls.reasonEnded', { notifyServer: true });
    };
    const onE2EE = () => setEncrypted(room.isE2EEEnabled);
    room.on(RoomEvent.ConnectionStateChanged, onState);
    room.on(RoomEvent.Disconnected, onDisconnected);
    room.on(RoomEvent.ParticipantDisconnected, onParticipantLeft);
    room.on(RoomEvent.ParticipantEncryptionStatusChanged, onE2EE);
    return () => {
      room.off(RoomEvent.ConnectionStateChanged, onState);
      room.off(RoomEvent.Disconnected, onDisconnected);
      room.off(RoomEvent.ParticipantDisconnected, onParticipantLeft);
      room.off(RoomEvent.ParticipantEncryptionStatusChanged, onE2EE);
    };
  }, [room, finish, call?.status]);

  useEffect(() => NetInfo.addEventListener((s) => setOffline(s.isConnected === false)), []);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Leaving the screen always hangs up.
  useEffect(
    () => () => {
      if (!finished.current) {
        finished.current = true;
        endCall(id).catch(() => {});
        room.disconnect().catch(() => {});
        AudioSession.stopAudioSession().catch(() => {});
      }
    },
    [id, room],
  );

  const toggleMic = async () => {
    const next = !micOn;
    await room.localParticipant.setMicrophoneEnabled(next).catch(() => {});
    setMicOn(next);
  };
  const toggleCam = async () => {
    const next = !camOn;
    await room.localParticipant.setCameraEnabled(next).catch(() => {});
    setCamOn(next);
  };
  const flipCam = () => {
    const track = room.localParticipant.getTrackPublication(Track.Source.Camera)?.track as LocalVideoTrack | undefined;
    (track?.mediaStreamTrack as unknown as { _switchCamera?: () => void })?._switchCamera?.();
  };
  const toggleSpeaker = async () => {
    const next = !speaker;
    try {
      const outputs = await AudioSession.getAudioOutputs();
      const target = next ? outputs.find((o) => o === 'speaker' || o === 'force_speaker') : outputs.find((o) => o === 'earpiece' || o === 'default');
      if (target) await AudioSession.selectAudioOutput(target);
      setSpeaker(next);
    } catch {
      // output switching unsupported on this device
    }
  };

  const status =
    phase === 'ended'
      ? endText ?? t('calls.reasonEnded')
      : offline
        ? t('calls.offline')
        : phase === 'preparing'
          ? t('calls.preparing')
          : phase === 'ringing'
            ? t('calls.ringing')
            : phase === 'connecting'
              ? t('calls.connecting')
              : phase === 'reconnecting'
                ? t('calls.reconnecting')
                : call?.answered_at
                  ? formatDuration((now - new Date(call.answered_at).getTime()) / 1000)
                  : t('calls.connecting');

  const isVideo = !!call?.video;
  const name = peer?.display_name ?? '…';

  return (
    <RoomContext.Provider value={room}>
      <View style={{ flex: 1, backgroundColor: '#090910' }}>
        <LinearGradient colors={['#0D1230', '#090910']} style={StyleSheet.absoluteFill} />
        {isVideo && phase !== 'ended' ? <VideoStage peer={peer} localOn={camOn} /> : null}

        <View style={{ paddingTop: insets.top + 24, alignItems: 'center', paddingHorizontal: 24 }}>
          {!isVideo || phase === 'ringing' || phase === 'ended' ? <Avatar name={name} seed={peer?.id ?? 'peer'} size={120} /> : null}
          <Text style={[styles.name, isVideo && phase === 'active' ? styles.shadow : null]}>{name}</Text>
          <Animated.Text key={status} entering={FadeIn} exiting={FadeOut} style={[styles.status, phase === 'ended' || offline ? { color: '#FCA5A5' } : null, isVideo ? styles.shadow : null]}>
            {status}
          </Animated.Text>
          {encrypted && phase !== 'ended' ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 }}>
              <Ionicons name="lock-closed" size={12} color="#38BDF8" />
              <Text style={[{ color: '#A1A1C2', fontSize: 12 }, isVideo ? styles.shadow : null]}>{t('calls.e2eShort')}</Text>
            </View>
          ) : null}
        </View>

        {phase !== 'ended' ? (
          <View style={{ position: 'absolute', left: 0, right: 0, bottom: insets.bottom + 30, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', rowGap: 18 }}>
            <CtrlButton icon={micOn ? 'mic' : 'mic-off'} label={micOn ? t('calls.mute') : t('calls.unmute')} active={!micOn} onPress={toggleMic} />
            <CtrlButton icon="volume-high" label={t('calls.speaker')} active={speaker} onPress={toggleSpeaker} />
            {isVideo ? <CtrlButton icon={camOn ? 'videocam' : 'videocam-off'} label={camOn ? t('calls.camOff') : t('calls.camOn')} active={!camOn} onPress={toggleCam} /> : null}
            {isVideo && camOn ? <CtrlButton icon="camera-reverse" label={t('calls.flip')} onPress={flipCam} /> : null}
            <CtrlButton icon="call" label={t('calls.hangUp')} danger onPress={() => finish(null, { notifyServer: true })} />
          </View>
        ) : null}
      </View>
    </RoomContext.Provider>
  );
}

const styles = StyleSheet.create({
  name: { color: '#fff', fontSize: 28, fontWeight: '800', marginTop: 22, textAlign: 'center' },
  status: { color: '#C4B5FD', fontSize: 16, marginTop: 8 },
  shadow: { textShadowColor: 'rgba(0,0,0,0.8)', textShadowRadius: 6 },
});
