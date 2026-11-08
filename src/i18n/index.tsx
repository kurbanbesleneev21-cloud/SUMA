import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import ru from './ru';
import en from './en';

type Leaves<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Leaves<T[K], `${P}${K}.`>;
}[keyof T & string];

export type TKey = Leaves<typeof ru>;
export type Locale = 'ru' | 'en';
export type Params = Record<string, string | number>;

// Adding a language = adding a dictionary of the same shape here.
export const dictionaries = { ru, en } as const;
export const localeNames: Record<Locale, string> = { ru: 'Русский', en: 'English' };

const KEY = 'nexo_locale';
let current: Locale = 'ru';

const lookup = (locale: Locale, key: string): string => {
  let node: unknown = dictionaries[locale];
  for (const part of key.split('.')) node = (node as Record<string, unknown> | undefined)?.[part];
  if (typeof node === 'string') return node;
  return locale === 'ru' ? key : lookup('ru', key);
};

export const translate = (locale: Locale, key: TKey, params?: Params) => {
  let s = lookup(locale, key);
  if (params) for (const [k, v] of Object.entries(params)) s = s.split(`{${k}}`).join(String(v));
  return s;
};

// For code outside React components (error mapping, formatting).
export const t = (key: TKey, params?: Params) => translate(current, key, params);
export const currentLocale = () => current;

// Russian plural forms: one (1, 21), few (2-4, 22-24), many (rest).
export const plural = (n: number, forms: { one: string; few: string; many: string }) => {
  if (current === 'en') return n === 1 ? forms.one : forms.many;
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return forms.one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return forms.few;
  return forms.many;
};

interface I18nValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: TKey, params?: Params) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    const device = getLocales()[0]?.languageCode;
    current = device === 'en' ? 'en' : 'ru';
    return current;
  });

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((v) => {
        if (v === 'ru' || v === 'en') {
          current = v;
          setLocaleState(v);
        }
      })
      .catch(() => {});
  }, []);

  const value = useMemo<I18nValue>(
    () => ({
      locale,
      setLocale: (l) => {
        current = l;
        setLocaleState(l);
        AsyncStorage.setItem(KEY, l).catch(() => {});
      },
      t: (key, params) => translate(locale, key, params),
    }),
    [locale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export const useI18n = () => {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n outside I18nProvider');
  return ctx;
};

export const useT = () => useI18n().t;
