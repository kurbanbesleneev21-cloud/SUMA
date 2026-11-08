import { Stack } from 'expo-router';
import { useColors } from '@/contexts/ThemeContext';

export default function AuthLayout() {
  const c = useColors();
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.background } }} />;
}
