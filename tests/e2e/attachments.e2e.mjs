// Live check of encrypted attachments against a real Supabase project, using the same storage
// endpoints and file format as the app. Needs test users qa_alice, qa_bob, qa_eve (@nexo-qa.test).
//   NEXO_URL=... NEXO_ANON_KEY=... NEXO_E2E_PASSWORD=... node --experimental-strip-types tests/e2e/attachments.e2e.mjs
import { createClient } from '@supabase/supabase-js';
import sodiumModule from 'libsodium-wrappers';
import { decryptBytes, encryptBytes } from '../../src/crypto/stream.ts';

const URL = process.env.NEXO_URL;
const KEY = process.env.NEXO_ANON_KEY;
const PW = process.env.NEXO_E2E_PASSWORD;
if (!URL || !KEY || !PW) throw new Error('Set NEXO_URL, NEXO_ANON_KEY, NEXO_E2E_PASSWORD');

const sodium = sodiumModule;
await sodium.ready;
const aead = {
  encrypt: (m, ad, n, k) => sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(m, ad, null, n, k),
  decrypt: (c, ad, n, k) => sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(null, c, ad, n, k),
};

let failed = 0;
const check = (name, ok, detail = '') => {
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ' — ' + detail : ''}`);
};

const login = async (user) => {
  const client = createClient(URL, KEY, { auth: { persistSession: false } });
  const { data, error } = await client.auth.signInWithPassword({ email: `${user}@nexo-qa.test`, password: PW });
  if (error) throw error;
  return { client, token: data.session.access_token };
};

const objectUrl = (path, auth = false) => `${URL}/storage/v1/object/${auth ? 'authenticated/' : ''}attachments/${path}`;
const upload = (token, path, body) =>
  fetch(objectUrl(path), { method: 'POST', headers: { Authorization: `Bearer ${token}`, apikey: KEY, 'Content-Type': 'application/octet-stream', 'x-upsert': 'false' }, body });
const download = (token, path) => fetch(objectUrl(path, true), { headers: { Authorization: `Bearer ${token}`, apikey: KEY } });

const alice = await login('qa_alice');
const bob = await login('qa_bob');
const eve = await login('qa_eve');

const { data: bobProfile } = await alice.client.from('profiles').select('id').eq('username', 'qa_bob').single();
const { data: chatId, error: chatErr } = await alice.client.rpc('create_direct_chat', { other: bobProfile.id });
if (chatErr) throw chatErr;

// A fake 2.5 MB "PDF" with a recognisable marker.
const marker = new TextEncoder().encode('%PDF-1.7 NEXO-SECRET-CONTRACT ');
const plain = new Uint8Array(2.5 * 1024 * 1024);
for (let i = 0; i < plain.length; i++) plain[i] = marker[i % marker.length];
const fileKey = sodium.randombytes_buf(32);
const enc = encryptBytes(aead, fileKey, sodium.randombytes_buf(16), plain);
const path = `${chatId}/qa${Buffer.from(sodium.randombytes_buf(12)).toString('hex')}`;

const up = await upload(alice.token, path, enc);
check('member uploads encrypted file into chat folder', up.ok, `HTTP ${up.status}`);

const down = await download(bob.token, path);
const got = new Uint8Array(await down.arrayBuffer());
check('other member downloads it', down.ok, `HTTP ${down.status}, ${got.length} bytes`);
check('stored object is ciphertext (no plaintext marker)', !Buffer.from(got).includes(Buffer.from('NEXO-SECRET-CONTRACT')));
let decryptedOk = false;
try {
  decryptedOk = Buffer.from(decryptBytes(aead, fileKey, got)).equals(Buffer.from(plain));
} catch {}
check('other member decrypts it with the key from the E2E message', decryptedOk);

const eveDown = await download(eve.token, path);
check('outsider cannot download the file', !eveDown.ok, `HTTP ${eveDown.status}`);

const anonDown = await fetch(objectUrl(path, true), { headers: { apikey: KEY } });
check('anonymous request cannot download the file', !anonDown.ok, `HTTP ${anonDown.status}`);

const publicDown = await fetch(`${URL}/storage/v1/object/public/attachments/${path}`);
check('file is not publicly reachable', !publicDown.ok, `HTTP ${publicDown.status}`);

const eveUp = await upload(eve.token, `${chatId}/qaevilupload1`, new Uint8Array([1, 2, 3]));
check('outsider cannot upload into the chat folder', !eveUp.ok, `HTTP ${eveUp.status}`);

const bobDel = await bob.client.storage.from('attachments').remove([path]);
const stillThere = await download(alice.token, path);
check('only the uploader can delete', stillThere.ok, `bob remove returned ${JSON.stringify(bobDel.data)}`);

const aliceDel = await alice.client.storage.from('attachments').remove([path]);
const gone = await download(alice.token, path);
check('uploader deletes the file', !gone.ok && !aliceDel.error, `HTTP ${gone.status}`);

console.log(failed ? `\n${failed} check(s) FAILED` : '\nall attachment checks passed');
process.exit(failed ? 1 : 0);
