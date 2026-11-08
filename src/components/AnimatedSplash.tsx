import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import NetInfo from '@react-native-community/netinfo';
import { useColors, useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useT } from '@/i18n';

const MIN_MS = 1400;
const PROFILE_TIMEOUT_MS = 5000;

function Dot({ index }: { index: number }) {
  const c = useColors();
  const v = useSharedValue(0.3);
  useEffect(() => {
    v.value = withDelay(index * 160, withRepeat(withSequence(withTiming(1, { duration: 420 }), withTiming(0.3, { duration: 420 })), -1));
  }, [index, v]);
  const style = useAnimatedStyle(() => ({ opacity: v.value, transform: [{ scale: 0.7 + v.value * 0.3 }] }));
  return <Animated.View style={[{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.neon, marginHorizontal: 4 }, style]} />;
}

// Shown over the app on cold start while auth, network and profile are checked.
export function AnimatedSplash({ onDone }: { onDone: () => void }) {
  const c = useColors();
  const t = useT();
  const { animations } = useTheme();
  const { ready, session, profile } = useAuth();
  const [step, setStep] = useState<'network' | 'auth' | 'profile'>('network');
  const [offline, setOffline] = useState(false);
  const [networkChecked, setNetworkChecked] = useState(false);
  const [minElapsed, setMinElapsed] = useState(false);
  const [profileTimedOut, setProfileTimedOut] = useState(false);

  const logoScale = useSharedValue(animations ? 0.4 : 1);
  const logoOpacity = useSharedValue(animations ? 0 : 1);
  const glow = useSharedValue(0);
  const wordOpacity = useSharedValue(animations ? 0 : 1);
  const wordShift = useSharedValue(animations ? 12 : 0);

  useEffect(() => {
    if (!animations) return;
    logoOpacity.value = withTiming(1, { duration: 450 });
    logoScale.value = withSpring(1, { damping: 11, stiffness: 120 });
    glow.value = withDelay(300, withRepeat(withSequence(withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.quad) }), withTiming(0.35, { duration: 1200 })), -1));
    wordOpacity.value = withDelay(350, withTiming(1, { duration: 500 }));
    wordShift.value = withDelay(350, withSpring(0, { damping: 14 }));
  }, [animations, glow, logoOpacity, logoScale, wordOpacity, wordShift]);

  useEffect(() => {
    const timer = setTimeout(() => setMinElapsed(true), animations ? MIN_MS : 300);
    NetInfo.fetch()
      .then((s) => setOffline(s.isConnected === false))
      .catch(() => {})
      .finally(() => {
        setNetworkChecked(true);
        setStep('auth');
      });
    return () => clearTimeout(timer);
  }, [animations]);

  useEffect(() => {
    if (!ready || !session) return;
    setStep('profile');
    const timer = setTimeout(() => setProfileTimedOut(true), PROFILE_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [ready, session]);

  const profileReady = !session || !!profile || profileTimedOut || offline;
  useEffect(() => {
    if (networkChecked && ready && profileReady && minElapsed) onDone();
  }, [networkChecked, ready, profileReady, minElapsed, onDone]);

  const logoStyle = useAnimatedStyle(() => ({ opacity: logoOpacity.value, transform: [{ scale: logoScale.value }] }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.value * 0.55, transform: [{ scale: 1 + glow.value * 0.25 }] }));
  const wordStyle = useAnimatedStyle(() => ({ opacity: wordOpacity.value, transform: [{ translateY: wordShift.value }] }));

  const status = offline ? t('splash.offline') : t(step === 'network' ? 'splash.network' : step === 'auth' ? 'splash.auth' : 'splash.profile');

  return (
    <Animated.View exiting={animations ? FadeOut.duration(350) : undefined} style={[StyleSheet.absoluteFill, { backgroundColor: c.background, alignItems: 'center', justifyContent: 'center', zIndex: 1000 }]}>
      <LinearGradient colors={[c.navy, c.background]} style={StyleSheet.absoluteFill} />
      <View style={{ alignItems: 'center', justifyContent: 'center' }}>
        <Animated.View style={[{ position: 'absolute', width: 180, height: 180, borderRadius: 90, backgroundColor: c.primary }, glowStyle]} />
        <Animated.View style={logoStyle}>
          <LinearGradient colors={c.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: 112, height: 112, borderRadius: 34, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: '#fff', fontSize: 62, fontWeight: '900' }}>N</Text>
          </LinearGradient>
        </Animated.View>
      </View>
      <Animated.View style={[{ alignItems: 'center', marginTop: 34 }, wordStyle]}>
        <Text style={{ color: c.text, fontSize: 34, fontWeight: '900', letterSpacing: 10 }}>NEXO</Text>
        <Text style={{ color: c.textMuted, fontSize: 14, marginTop: 6 }}>{t('splash.tagline')}</Text>
      </Animated.View>
      <View style={{ position: 'absolute', bottom: 90, alignItems: 'center' }}>
        <View style={{ flexDirection: 'row', marginBottom: 14 }}>
          {[0, 1, 2].map((i) => (animations ? <Dot key={i} index={i} /> : <View key={i} style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.neon, marginHorizontal: 4 }} />))}
        </View>
        <Text style={{ color: offline ? c.warning : c.textMuted, fontSize: 13 }}>{status}</Text>
      </View>
    </Animated.View>
  );
}
