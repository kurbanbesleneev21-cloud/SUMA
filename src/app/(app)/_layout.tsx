import React, { useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useColors } from '@/contexts/ThemeContext';
import { CallProvider } from '@/contexts/CallContext';

export default function AppLayout() {
  const c = useColors();
  const router = useRouter();
  const { passwordRecovery } = useAuth();

  useEffect(() => {
    if (passwordRecovery) router.push('/change-password');
  }, [passwordRecovery, router]);

  return (
    <CallProvider>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.background }, animation: 'slide_from_right' }}>
        <Stack.Screen name="call/[id]" options={{ animation: 'fade', gestureEnabled: false }} />
      </Stack>
    </CallProvider>
  );
}
