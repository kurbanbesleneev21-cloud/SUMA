import nacl from 'tweetnacl';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { generateKeyPair, keyPairFromSecret, KeyPair } from './box';

nacl.setPRNG((out: Uint8Array, n: number) => {
  out.set(Crypto.getRandomBytes(n));
});

const storeKey = (userId: string) => `nexo_box_sk_${userId.replace(/[^a-zA-Z0-9]/g, '')}`;

const options: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

export const loadOrCreateKeyPair = async (userId: string): Promise<{ keys: KeyPair; created: boolean }> => {
  const stored = await SecureStore.getItemAsync(storeKey(userId), options);
  if (stored) return { keys: keyPairFromSecret(stored), created: false };
  const keys = generateKeyPair();
  await SecureStore.setItemAsync(storeKey(userId), keys.secretKey, options);
  return { keys, created: true };
};
