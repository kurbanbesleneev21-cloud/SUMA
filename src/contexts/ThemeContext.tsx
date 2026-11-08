import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { palettes, Palette } from '@/constants/theme';

export type ThemeMode = 'dark' | 'light' | 'system';

interface ThemeValue {
  mode: ThemeMode;
  scheme: 'dark' | 'light';
  colors: Palette;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeValue | null>(null);
const KEY = 'nexo_theme_mode';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('dark');

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((v) => {
        if (v === 'dark' || v === 'light' || v === 'system') setModeState(v);
      })
      .catch(() => {});
  }, []);

  const value = useMemo<ThemeValue>(() => {
    const scheme = mode === 'system' ? (system === 'light' ? 'light' : 'dark') : mode;
    return {
      mode,
      scheme,
      colors: palettes[scheme],
      setMode: (m) => {
        setModeState(m);
        AsyncStorage.setItem(KEY, m).catch(() => {});
      },
    };
  }, [mode, system]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme outside ThemeProvider');
  return ctx;
};

export const useColors = () => useTheme().colors;
