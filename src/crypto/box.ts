import nacl from 'tweetnacl';
import util from 'tweetnacl-util';

// X25519 key agreement + XSalsa20-Poly1305 authenticated encryption (NaCl crypto_box).
// The same shared key is derived by both parties, so the sender can also read what it sent.

export interface KeyPair {
  publicKey: string;
  secretKey: string;
}

export interface Envelope {
  ciphertext: string;
  nonce: string;
  senderKey: string;
  recipientKey: string;
}

export const generateKeyPair = (): KeyPair => {
  const kp = nacl.box.keyPair();
  return { publicKey: util.encodeBase64(kp.publicKey), secretKey: util.encodeBase64(kp.secretKey) };
};

export const keyPairFromSecret = (secretKey: string): KeyPair => {
  const kp = nacl.box.keyPair.fromSecretKey(util.decodeBase64(secretKey));
  return { publicKey: util.encodeBase64(kp.publicKey), secretKey };
};

const decodeKey = (key: string): Uint8Array => {
  const bytes = util.decodeBase64(key);
  if (bytes.length !== nacl.box.publicKeyLength) throw new Error('invalid key length');
  return bytes;
};

export const encryptText = (plaintext: string, own: KeyPair, recipientPublicKey: string): Envelope => {
  const nonce = nacl.randomBytes(nacl.box.nonceLength);
  const sealed = nacl.box(
    util.decodeUTF8(plaintext),
    nonce,
    decodeKey(recipientPublicKey),
    util.decodeBase64(own.secretKey),
  );
  return {
    ciphertext: util.encodeBase64(sealed),
    nonce: util.encodeBase64(nonce),
    senderKey: own.publicKey,
    recipientKey: recipientPublicKey,
  };
};

// Returns null when the message was not addressed to this key pair or was tampered with.
export const decryptText = (env: Envelope, own: KeyPair): string | null => {
  let peerKey: string;
  if (env.recipientKey === own.publicKey) peerKey = env.senderKey;
  else if (env.senderKey === own.publicKey) peerKey = env.recipientKey;
  else return null;
  try {
    const opened = nacl.box.open(
      util.decodeBase64(env.ciphertext),
      util.decodeBase64(env.nonce),
      decodeKey(peerKey),
      util.decodeBase64(own.secretKey),
    );
    return opened ? util.encodeUTF8(opened) : null;
  } catch {
    return null;
  }
};

// Short human-comparable fingerprint of a public key, for out-of-band verification.
export const fingerprint = (publicKey: string): string => {
  const hash = nacl.hash(util.decodeBase64(publicKey));
  const digits = Array.from(hash.slice(0, 15), (b) => (b % 100).toString().padStart(2, '0')).join('');
  return digits.match(/.{1,5}/g)!.join(' ');
};
