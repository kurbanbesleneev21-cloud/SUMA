// Chunked authenticated file encryption (STREAM construction, as used by age / Tink):
// XChaCha20-Poly1305-IETF over 1 MiB chunks. Nonce = 16-byte random prefix || u64 chunk index,
// with the top bit of the last byte set on the final chunk. Header bytes are bound as AAD.
// Reordering, truncation, extension or any bit flip makes decryption fail.

export const CHUNK = 1024 * 1024;
export const TAG = 16;
export const KEY_BYTES = 32;
const MAGIC = [0x4e, 0x58, 0x46, 0x31]; // "NXF1"
export const HEADER_BYTES = MAGIC.length + 16;

export interface Aead {
  encrypt(message: Uint8Array, ad: Uint8Array, nonce: Uint8Array, key: Uint8Array): Uint8Array;
  // Must throw on authentication failure.
  decrypt(ciphertext: Uint8Array, ad: Uint8Array, nonce: Uint8Array, key: Uint8Array): Uint8Array;
}

export const makeHeader = (noncePrefix: Uint8Array) => {
  if (noncePrefix.length !== 16) throw new Error('nonce prefix must be 16 bytes');
  const h = new Uint8Array(HEADER_BYTES);
  h.set(MAGIC, 0);
  h.set(noncePrefix, MAGIC.length);
  return h;
};

export const parseHeader = (header: Uint8Array) => {
  if (header.length !== HEADER_BYTES || MAGIC.some((b, i) => header[i] !== b)) throw new Error('not a NEXO encrypted file');
  return header.slice(MAGIC.length);
};

const chunkNonce = (prefix: Uint8Array, index: number, last: boolean) => {
  const n = new Uint8Array(24);
  n.set(prefix, 0);
  let v = index;
  for (let i = 16; i < 24; i++) {
    n[i] = v % 256;
    v = Math.floor(v / 256);
  }
  if (last) n[23] |= 0x80;
  return n;
};

export const sealChunk = (aead: Aead, key: Uint8Array, header: Uint8Array, index: number, last: boolean, plain: Uint8Array) =>
  aead.encrypt(plain, header, chunkNonce(header.slice(MAGIC.length), index, last), key);

export const openChunk = (aead: Aead, key: Uint8Array, header: Uint8Array, index: number, last: boolean, sealed: Uint8Array) => {
  if (sealed.length < TAG) throw new Error('chunk too short');
  return aead.decrypt(sealed, header, chunkNonce(header.slice(MAGIC.length), index, last), key);
};

export const encryptedSize = (plainSize: number) => {
  const chunks = Math.max(1, Math.ceil(plainSize / CHUNK));
  return HEADER_BYTES + plainSize + chunks * TAG;
};

// Layout of an encrypted file of a given size; rejects sizes no valid file can have.
export const chunkLayout = (encSize: number) => {
  const body = encSize - HEADER_BYTES;
  if (body < TAG) throw new Error('encrypted file truncated');
  const full = CHUNK + TAG;
  const count = Math.max(1, Math.ceil(body / full));
  const lastLen = body - (count - 1) * full;
  if (lastLen < TAG) throw new Error('encrypted file truncated');
  return { count, sealedLength: (i: number) => (i < count - 1 ? full : lastLen) };
};

// In-memory helpers (used by tests and small payloads).
export const encryptBytes = (aead: Aead, key: Uint8Array, noncePrefix: Uint8Array, plain: Uint8Array) => {
  const header = makeHeader(noncePrefix);
  const parts: Uint8Array[] = [header];
  const count = Math.max(1, Math.ceil(plain.length / CHUNK));
  for (let i = 0; i < count; i++) parts.push(sealChunk(aead, key, header, i, i === count - 1, plain.subarray(i * CHUNK, (i + 1) * CHUNK)));
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
};

export const decryptBytes = (aead: Aead, key: Uint8Array, data: Uint8Array) => {
  const header = data.subarray(0, HEADER_BYTES);
  parseHeader(header);
  const { count, sealedLength } = chunkLayout(data.length);
  const parts: Uint8Array[] = [];
  let o = HEADER_BYTES;
  for (let i = 0; i < count; i++) {
    const len = sealedLength(i);
    parts.push(openChunk(aead, key, header, i, i === count - 1, data.subarray(o, o + len)));
    o += len;
  }
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let p = 0;
  for (const part of parts) {
    out.set(part, p);
    p += part.length;
  }
  return out;
};
