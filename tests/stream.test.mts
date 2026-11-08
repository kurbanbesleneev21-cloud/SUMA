import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import sodiumModule from 'libsodium-wrappers';
import type { Aead } from '../src/crypto/stream.ts';
import { CHUNK, decryptBytes, encryptBytes, encryptedSize, HEADER_BYTES, TAG } from '../src/crypto/stream.ts';

const sodium = sodiumModule as unknown as typeof import('libsodium-wrappers');
let aead: Aead;
let key: Uint8Array;
const random = (n: number) => sodium.randombytes_buf(n);

before(async () => {
  await sodium.ready;
  aead = {
    encrypt: (m, ad, n, k) => sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(m, ad, null, n, k),
    decrypt: (c, ad, n, k) => sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(null, c, ad, n, k),
  };
  key = random(32);
});

const sizes = [0, 1, 1000, CHUNK - 1, CHUNK, CHUNK + 1, 3 * CHUNK + 12345];

test('roundtrip for edge-case sizes', () => {
  for (const size of sizes) {
    const plain = random(size);
    const enc = encryptBytes(aead, key, random(16), plain);
    assert.equal(enc.length, encryptedSize(size), `size ${size}`);
    assert.deepEqual(decryptBytes(aead, key, enc), plain, `size ${size}`);
  }
});

test('ciphertext reveals nothing of the plaintext pattern', () => {
  const plain = new TextEncoder().encode('%PDF-1.7 secret contract '.repeat(2000));
  const enc = encryptBytes(aead, key, random(16), plain);
  assert.ok(!Buffer.from(enc).includes(Buffer.from('%PDF')));
  assert.ok(!Buffer.from(enc).includes(Buffer.from('secret contract')));
});

test('cannot decrypt without the key', () => {
  const enc = encryptBytes(aead, key, random(16), random(5000));
  assert.throws(() => decryptBytes(aead, random(32), enc));
});

test('detects a flipped bit anywhere', () => {
  const plain = random(2 * CHUNK + 10);
  const enc = encryptBytes(aead, key, random(16), plain);
  for (const pos of [HEADER_BYTES + 5, HEADER_BYTES + CHUNK + TAG + 7, enc.length - 1]) {
    const bad = enc.slice();
    bad[pos] ^= 0x01;
    assert.throws(() => decryptBytes(aead, key, bad), `pos ${pos}`);
  }
});

test('detects a tampered header', () => {
  const enc = encryptBytes(aead, key, random(16), random(100));
  const bad = enc.slice();
  bad[HEADER_BYTES - 1] ^= 0x80;
  assert.throws(() => decryptBytes(aead, key, bad));
});

test('detects truncation at a chunk boundary', () => {
  const enc = encryptBytes(aead, key, random(16), random(2 * CHUNK + 500));
  const cut = enc.slice(0, HEADER_BYTES + 2 * (CHUNK + TAG));
  assert.throws(() => decryptBytes(aead, key, cut));
});

test('detects swapped chunks', () => {
  const enc = encryptBytes(aead, key, random(16), random(2 * CHUNK + 500));
  const a = enc.slice(HEADER_BYTES, HEADER_BYTES + CHUNK + TAG);
  const b = enc.slice(HEADER_BYTES + CHUNK + TAG, HEADER_BYTES + 2 * (CHUNK + TAG));
  const swapped = enc.slice();
  swapped.set(b, HEADER_BYTES);
  swapped.set(a, HEADER_BYTES + CHUNK + TAG);
  assert.throws(() => decryptBytes(aead, key, swapped));
});

test('detects an appended chunk', () => {
  const enc = encryptBytes(aead, key, random(16), random(CHUNK));
  const extended = new Uint8Array(enc.length + CHUNK + TAG);
  extended.set(enc);
  assert.throws(() => decryptBytes(aead, key, extended));
});

test('rejects a non-NEXO file', () => {
  assert.throws(() => decryptBytes(aead, key, random(500)));
});

test('same file encrypted twice gives different ciphertexts', () => {
  const plain = random(1000);
  assert.notDeepEqual(encryptBytes(aead, key, random(16), plain), encryptBytes(aead, key, random(16), plain));
});
