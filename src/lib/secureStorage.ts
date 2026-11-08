import * as SecureStore from 'expo-secure-store';

// SecureStore values are size-limited, and Supabase sessions can exceed that, so values are chunked.
const CHUNK = 1800;
const safe = (key: string) => key.replace(/[^a-zA-Z0-9._-]/g, '_');

export const secureStorage = {
  async getItem(key: string): Promise<string | null> {
    const count = await SecureStore.getItemAsync(`${safe(key)}__n`);
    if (!count) return null;
    const parts: string[] = [];
    for (let i = 0; i < Number(count); i++) {
      const part = await SecureStore.getItemAsync(`${safe(key)}__${i}`);
      if (part === null) return null;
      parts.push(part);
    }
    return parts.join('');
  },
  async setItem(key: string, value: string): Promise<void> {
    await this.removeItem(key);
    const n = Math.ceil(value.length / CHUNK);
    for (let i = 0; i < n; i++) {
      await SecureStore.setItemAsync(`${safe(key)}__${i}`, value.slice(i * CHUNK, (i + 1) * CHUNK));
    }
    await SecureStore.setItemAsync(`${safe(key)}__n`, String(n));
  },
  async removeItem(key: string): Promise<void> {
    const count = await SecureStore.getItemAsync(`${safe(key)}__n`);
    if (!count) return;
    for (let i = 0; i < Number(count); i++) await SecureStore.deleteItemAsync(`${safe(key)}__${i}`);
    await SecureStore.deleteItemAsync(`${safe(key)}__n`);
  },
};
