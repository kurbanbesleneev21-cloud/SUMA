import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AccentId, accents, buildPalette, Palette } from '@/constants/theme';

export type ThemeMode = 'dark' | 'light' | 'system';
export type TextSize = 'small' | 'normal' | 'large';

interface Appearance {
  mode: ThemeMode;
  accent: AccentId;
  textSize: TextSize;
  animations: boolean;
}

interface ThemeValue extends Appearance {
  scheme: 'dark' | 'light';
  colors: Palette;
  fs: (size: number) => number;
  update: (patch: Partial<Appearance>) => void;
}

const KEY = 'nexo_appearance_v1';
const defaults: Appearance = { mode: 'dark', accent: 'violet', textSize: 'normal', animations: true };
const scale: Record<TextSize, number> = { small: 0.9, normal: 1, large: 1.15 };

const ThemeContext = createContext<ThemeValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [state, setState] = useState<Appearance>(defaults);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => {
        if (!raw) return;
        const saved = JSON.parse(raw) as Partial<Appearance>;
        setState((s) => ({
          mode: saved.mode && ['dark', 'light', 'system'].includes(saved.mode) ? saved.mode : s.mode,
          accent: saved.accent && saved.accent in accents ? saved.accent : s.accent,
          textSize: saved.textSize && saved.textSize in scale ? saved.textSize : s.textSize,
          animations: typeof saved.animations === 'boolean' ? saved.animations : s.animations,
        }));
      })
      .catch(() => {});
  }, []);

  const value = useMemo<ThemeValue>(() => {
    const scheme = state.mode === 'system' ? (system === 'light' ? 'light' : 'dark') : state.mode;
    return {
      ...state,
      scheme,
      colors: buildPalette(scheme, state.accent),
      fs: (size) => Math.round(size * scale[state.textSize]),
      update: (patch) =>
        setState((s) => {
          const next = { ...s, ...patch };
          AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
          return next;
        }),
    };
  }, [state, system]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme outside ThemeProvider');
  return ctx;
};

export const useColors = () => useTheme().colors;
