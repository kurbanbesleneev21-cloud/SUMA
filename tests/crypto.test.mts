import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPair, encryptText, decryptText, keyPairFromSecret, fingerprint } from '../src/crypto/box.ts';

const alice = generateKeyPair();
const bob = generateKeyPair();
const eve = generateKeyPair();
const text = 'Привет, Боб! Секрет 🔐';

test('recipient decrypts', () => {
  assert.equal(decryptText(encryptText(text, alice, bob.publicKey), bob), text);
});

test('sender can re-read own message', () => {
  assert.equal(decryptText(encryptText(text, alice, bob.publicKey), alice), text);
});

test('ciphertext does not contain plaintext', () => {
  const env = encryptText(text, alice, bob.publicKey);
  assert.ok(!env.ciphertext.includes('Привет'));
  assert.ok(!Buffer.from(env.ciphertext, 'base64').toString('utf8').includes('Привет'));
});

test('outsider cannot decrypt', () => {
  assert.equal(decryptText(encryptText(text, alice, bob.publicKey), eve), null);
});

test('outsider cannot decrypt even by forging the key fields', () => {
  const env = encryptText(text, alice, bob.publicKey);
  assert.equal(decryptText({ ...env, recipientKey: eve.publicKey }, eve), null);
});

test('wrong secret key with right public key fails', () => {
  const env = encryptText(text, alice, bob.publicKey);
  assert.equal(decryptText(env, { publicKey: bob.publicKey, secretKey: eve.secretKey }), null);
});

test('tampered ciphertext is rejected', () => {
  const env = encryptText(text, alice, bob.publicKey);
  const raw = Buffer.from(env.ciphertext, 'base64');
  raw[raw.length - 1] ^= 0x01;
  assert.equal(decryptText({ ...env, ciphertext: raw.toString('base64') }, bob), null);
});

test('tampered nonce is rejected', () => {
  const env = encryptText(text, alice, bob.publicKey);
  const n = Buffer.from(env.nonce, 'base64');
  n[0] ^= 0xff;
  assert.equal(decryptText({ ...env, nonce: n.toString('base64') }, bob), null);
});

test('truncated ciphertext is rejected', () => {
  const env = encryptText(text, alice, bob.publicKey);
  assert.equal(decryptText({ ...env, ciphertext: env.ciphertext.slice(0, 8) }, bob), null);
});

test('each message uses a fresh nonce', () => {
  const a = encryptText(text, alice, bob.publicKey);
  const b = encryptText(text, alice, bob.publicKey);
  assert.notEqual(a.nonce, b.nonce);
  assert.notEqual(a.ciphertext, b.ciphertext);
});

test('key pair restores from secret only', () => {
  assert.deepEqual(keyPairFromSecret(alice.secretKey), alice);
});

test('field sizes match database constraints', () => {
  const env = encryptText(text, alice, bob.publicKey);
  assert.equal(env.nonce.length, 32);
  assert.equal(env.senderKey.length, 44);
  assert.equal(env.recipientKey.length, 44);
});

test('fingerprint is stable and distinct', () => {
  assert.equal(fingerprint(alice.publicKey), fingerprint(alice.publicKey));
  assert.notEqual(fingerprint(alice.publicKey), fingerprint(bob.publicKey));
});
