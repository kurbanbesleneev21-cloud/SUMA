import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { AuthProvider } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';

SplashScreen.preventAutoHideAsync();

const RootLayoutNav = () => {
  const { isAuthenticated, loading } = useAuth();

  React.useEffect(() => {
    if (!loading) {
      SplashScreen.hideAsync();
    }
  }, [loading]);

  if (loading) {
    return <Stack />;
  }

  return (
    <>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <Stack
        screenOptions={{
          headerShown: false,
          cardStyle: { backgroundColor: '#000000' },
          animationEnabled: true,
        }}
      >
        {isAuthenticated ? (
          <>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Group screenOptions={{ presentation: 'modal' }}>
              <Stack.Screen name="chat/[id]" />
              <Stack.Screen name="profile" />
              <Stack.Screen name="blocked-users" />
              <Stack.Screen name="change-password" />
              <Stack.Screen name="notifications" />
              <Stack.Screen name="create-group" />
              <Stack.Screen name="group/[id]" />
            </Stack.Group>
          </>
        ) : (
          <Stack.Screen name="auth" options={{ headerShown: false }} />
        )}
      </Stack>
    </>
  );
};

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <RootLayoutNav />
      </AuthProvider>
    </ThemeProvider>
  );
}
