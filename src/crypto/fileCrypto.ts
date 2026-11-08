import sodium from 'react-native-libsodium';
import { File, FileMode, Paths, Directory } from 'expo-file-system';
import util from 'tweetnacl-util';
import { Aead, CHUNK, chunkLayout, HEADER_BYTES, KEY_BYTES, makeHeader, openChunk, parseHeader, sealChunk } from './stream';

const aead: Aead = {
  encrypt: (m, ad, n, k) => sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(m.slice(), ad.slice(), null, n, k),
  decrypt: (c, ad, n, k) => sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(null, c.slice(), ad.slice(), n, k),
};

export const workDir = () => {
  const dir = new Directory(Paths.cache, 'nexo-work');
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
};

const randomName = () => util.encodeBase64(sodium.randombytes_buf(12)).replace(/[^a-zA-Z0-9]/g, '');

// Encrypts a local file chunk by chunk with a fresh random key. Returns the encrypted temp file.
export async function encryptFile(srcUri: string, onProgress?: (fraction: number) => void) {
  const src = new File(srcUri);
  const size = src.size ?? 0;
  const key = sodium.randombytes_buf(KEY_BYTES);
  const header = makeHeader(sodium.randombytes_buf(16));
  const out = new File(workDir(), `${randomName()}.enc`);
  out.create({ overwrite: true });
  const reader = src.open(FileMode.ReadOnly);
  const writer = out.open(FileMode.Truncate);
  try {
    await writer.writeBytes(header);
    const count = Math.max(1, Math.ceil(size / CHUNK));
    for (let i = 0; i < count; i++) {
      const plain = i * CHUNK < size ? await reader.readBytes(Math.min(CHUNK, size - i * CHUNK)) : new Uint8Array(0);
      await writer.writeBytes(sealChunk(aead, key, header, i, i === count - 1, plain));
      onProgress?.((i + 1) / count);
    }
  } finally {
    reader.close();
    writer.close();
  }
  return { file: out, key: util.encodeBase64(key), plainSize: size, encSize: out.size ?? 0 };
}

// Decrypts into `dest`. Throws if the file was modified, truncated, or the key is wrong;
// a partially written output is removed in that case.
export async function decryptFile(enc: File, keyB64: string, dest: File, onProgress?: (fraction: number) => void) {
  const key = util.decodeBase64(keyB64);
  const { count, sealedLength } = chunkLayout(enc.size ?? 0);
  if (dest.exists) dest.delete();
  dest.create({ intermediates: true });
  const reader = enc.open(FileMode.ReadOnly);
  const writer = dest.open(FileMode.Truncate);
  let ok = false;
  try {
    const header = await reader.readBytes(HEADER_BYTES);
    parseHeader(header);
    for (let i = 0; i < count; i++) {
      const sealed = await reader.readBytes(sealedLength(i));
      await writer.writeBytes(openChunk(aead, key, header, i, i === count - 1, sealed));
      onProgress?.((i + 1) / count);
    }
    ok = true;
  } finally {
    reader.close();
    writer.close();
    if (!ok && dest.exists) dest.delete();
  }
  return dest;
}
