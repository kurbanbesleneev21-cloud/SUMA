import nacl from 'tweetnacl';
import { v4 as uuidv4 } from 'uuid';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS_STORAGE_KEY = '@nexo_crypto_keys';
const DEVICE_KEY_ID = '@nexo_device_key_id';

export class CryptoService {
  private staticKeypair: nacl.BoxKeyPair | null = null;

  async generateKeyPair(): Promise<nacl.BoxKeyPair> {
    return nacl.box.keyPair();
  }

  async initializeDeviceKeys(): Promise<void> {
    try {
      const storedKeyId = await AsyncStorage.getItem(DEVICE_KEY_ID);
      if (!storedKeyId) {
        const keypair = this.generateKeyPair();
        const keyId = uuidv4();
        this.staticKeypair = keypair;
        await AsyncStorage.setItem(DEVICE_KEY_ID, keyId);
        await AsyncStorage.setItem(
          `${KEYS_STORAGE_KEY}_${keyId}`,
          JSON.stringify({
            publicKey: Array.from(keypair.publicKey),
            secretKey: Array.from(keypair.secretKey),
          })
        );
      } else {
        const stored = await AsyncStorage.getItem(`${KEYS_STORAGE_KEY}_${storedKeyId}`);
        if (stored) {
          const parsed = JSON.parse(stored);
          this.staticKeypair = {
            publicKey: new Uint8Array(parsed.publicKey),
            secretKey: new Uint8Array(parsed.secretKey),
          };
        }
      }
    } catch (error) {
      console.error('Error initializing crypto keys:', error);
      throw error;
    }
  }

  getPublicKey(): Uint8Array {
    if (!this.staticKeypair) {
      throw new Error('Crypto keys not initialized');
    }
    return this.staticKeypair.publicKey;
  }

  encryptMessage(message: string, recipientPublicKey: Uint8Array): {
    ciphertext: string;
    nonce: string;
  } {
    if (!this.staticKeypair) {
      throw new Error('Crypto keys not initialized');
    }

    const nonce = nacl.randomBytes(24);
    const messageBytes = new TextEncoder().encode(message);

    const ciphertext = nacl.box(
      messageBytes,
      nonce,
      recipientPublicKey,
      this.staticKeypair.secretKey
    );

    return {
      ciphertext: Buffer.from(ciphertext).toString('base64'),
      nonce: Buffer.from(nonce).toString('base64'),
    };
  }

  decryptMessage(
    ciphertext: string,
    nonce: string,
    senderPublicKey: Uint8Array
  ): string {
    if (!this.staticKeypair) {
      throw new Error('Crypto keys not initialized');
    }

    const ciphertextBytes = Buffer.from(ciphertext, 'base64');
    const nonceBytes = Buffer.from(nonce, 'base64');

    const plaintext = nacl.box.open(
      ciphertextBytes,
      nonceBytes,
      senderPublicKey,
      this.staticKeypair.secretKey
    );

    if (!plaintext) {
      throw new Error('Failed to decrypt message');
    }

    return new TextDecoder().decode(plaintext);
  }

  generateSymmetricKey(): Uint8Array {
    return nacl.randomBytes(32);
  }

  encryptFile(
    fileData: Uint8Array,
    symmetricKey: Uint8Array
  ): { ciphertext: string; nonce: string } {
    const nonce = nacl.randomBytes(24);
    const ciphertext = nacl.secretbox(fileData, nonce, symmetricKey);

    return {
      ciphertext: Buffer.from(ciphertext).toString('base64'),
      nonce: Buffer.from(nonce).toString('base64'),
    };
  }

  decryptFile(
    ciphertext: string,
    nonce: string,
    symmetricKey: Uint8Array
  ): Uint8Array {
    const ciphertextBytes = Buffer.from(ciphertext, 'base64');
    const nonceBytes = Buffer.from(nonce, 'base64');

    const plaintext = nacl.secretbox.open(ciphertextBytes, nonceBytes, symmetricKey);

    if (!plaintext) {
      throw new Error('Failed to decrypt file');
    }

    return plaintext;
  }

  encryptSymmetricKey(
    symmetricKey: Uint8Array,
    recipientPublicKey: Uint8Array
  ): { ciphertext: string; nonce: string } {
    if (!this.staticKeypair) {
      throw new Error('Crypto keys not initialized');
    }

    const nonce = nacl.randomBytes(24);
    const ciphertext = nacl.box(
      symmetricKey,
      nonce,
      recipientPublicKey,
      this.staticKeypair.secretKey
    );

    return {
      ciphertext: Buffer.from(ciphertext).toString('base64'),
      nonce: Buffer.from(nonce).toString('base64'),
    };
  }

  decryptSymmetricKey(
    ciphertext: string,
    nonce: string,
    senderPublicKey: Uint8Array
  ): Uint8Array {
    if (!this.staticKeypair) {
      throw new Error('Crypto keys not initialized');
    }

    const ciphertextBytes = Buffer.from(ciphertext, 'base64');
    const nonceBytes = Buffer.from(nonce, 'base64');

    const key = nacl.box.open(ciphertextBytes, nonceBytes, senderPublicKey, this.staticKeypair.secretKey);

    if (!key) {
      throw new Error('Failed to decrypt symmetric key');
    }

    return key;
  }

  encodeBase64(bytes: Uint8Array): string {
    return Buffer.from(bytes).toString('base64');
  }

  decodeBase64(encoded: string): Uint8Array {
    return new Uint8Array(Buffer.from(encoded, 'base64'));
  }
}

export const cryptoService = new CryptoService();
