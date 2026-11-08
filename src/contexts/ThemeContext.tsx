import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type Theme = 'dark' | 'light';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const colors = {
  dark: {
    background: '#000000',
    surface: '#1a1a1a',
    surfaceLight: '#2d2d2d',
    text: '#ffffff',
    textSecondary: '#999999',
    border: '#333333',
    primary: '#7c3aed',
    primaryLight: '#a855f7',
    secondary: '#3b82f6',
    danger: '#ef4444',
    success: '#22c55e',
  },
  light: {
    background: '#ffffff',
    surface: '#f5f5f5',
    surfaceLight: '#e9e9e9',
    text: '#000000',
    textSecondary: '#666666',
    border: '#e0e0e0',
    primary: '#7c3aed',
    primaryLight: '#a855f7',
    secondary: '#3b82f6',
    danger: '#ef4444',
    success: '#22c55e',
  },
};

export type ColorScheme = typeof colors.dark;

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>('dark');

  useEffect(() => {
    const loadTheme = async () => {
      try {
        const savedTheme = await AsyncStorage.getItem('@nexo_theme');
        if (savedTheme === 'light' || savedTheme === 'dark') {
          setThemeState(savedTheme);
        }
      } catch (error) {
        console.error('Error loading theme:', error);
      }
    };

    loadTheme();
  }, []);

  const setTheme = async (newTheme: Theme) => {
    setThemeState(newTheme);
    try {
      await AsyncStorage.setItem('@nexo_theme', newTheme);
    } catch (error) {
      console.error('Error saving theme:', error);
    }
  };

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};

export const useColors = (): ColorScheme => {
  const { theme } = useTheme();
  return colors[theme] as ColorScheme;
};
