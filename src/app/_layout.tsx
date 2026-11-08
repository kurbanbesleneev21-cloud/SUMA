import React, { useCallback, useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { registerGlobals } from '@livekit/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { AppLockProvider } from '@/contexts/AppLockContext';
import { I18nProvider } from '@/i18n';
import { OfflineBanner } from '@/components/ui';
import { AnimatedSplash } from '@/components/AnimatedSplash';

SplashScreen.preventAutoHideAsync().catch(() => {});
// WebRTC globals for LiveKit calls; must run before any call code.
registerGlobals();

function Navigation() {
  const { ready, configured, session } = useAuth();
  const { scheme, colors, animations } = useTheme();
  const [splashDone, setSplashDone] = useState(false);
  const finishSplash = useCallback(() => setSplashDone(true), []);

  // The animated splash takes over from the native one as soon as JS is running.
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      {ready ? (
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.background },
            animation: animations ? 'slide_from_right' : 'none',
          }}
        >
          <Stack.Protected guard={!configured}>
            <Stack.Screen name="setup" />
          </Stack.Protected>
          <Stack.Protected guard={configured && !session}>
            <Stack.Screen name="(auth)" />
          </Stack.Protected>
          <Stack.Protected guard={configured && !!session}>
            <Stack.Screen name="(app)" />
          </Stack.Protected>
          <Stack.Screen name="auth-callback" />
          <Stack.Screen name="legal/[doc]" options={{ animation: animations ? 'slide_from_bottom' : 'none' }} />
        </Stack>
      ) : null}
      {splashDone ? <OfflineBanner /> : <AnimatedSplash onDone={finishSplash} />}
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <I18nProvider>
        <ThemeProvider>
          <AuthProvider>
            <AppLockProvider>
              <Navigation />
            </AppLockProvider>
          </AuthProvider>
        </ThemeProvider>
      </I18nProvider>
    </SafeAreaProvider>
  );
}
