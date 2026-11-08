// Live check of call signalling and LiveKit token issuance (needs LIVEKIT_* secrets on the project).
//   NEXO_URL=... NEXO_ANON_KEY=... NEXO_E2E_PASSWORD=... node tests/e2e/calls.e2e.mjs
import { createClient } from '@supabase/supabase-js';

const URL = process.env.NEXO_URL;
const KEY = process.env.NEXO_ANON_KEY;
const PW = process.env.NEXO_E2E_PASSWORD;
if (!URL || !KEY || !PW) throw new Error('Set NEXO_URL, NEXO_ANON_KEY, NEXO_E2E_PASSWORD');

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

const tokenFor = async (who, callId) => {
  const r = await fetch(`${URL}/functions/v1/livekit-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: KEY, Authorization: `Bearer ${who.token}` },
    body: JSON.stringify({ call_id: callId }),
  });
  return { status: r.status, body: await r.json().catch(() => ({})) };
};

const claims = (jwt) => JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString());

const alice = await login('qa_alice');
const bob = await login('qa_bob');
const eve = await login('qa_eve');
const { data: bobProfile } = await alice.client.from('profiles').select('id').eq('username', 'qa_bob').single();
const { data: chatId } = await alice.client.rpc('create_direct_chat', { other: bobProfile.id });

const { data: call, error: startErr } = await alice.client.rpc('start_call', { c: chatId, with_video: true, encrypted_key: '{"test":true}' });
check('caller starts a call', !startErr && call?.status === 'ringing', startErr?.message ?? call?.status);

const callerTok = await tokenFor(alice, call.id);
check('caller gets a LiveKit token while ringing', callerTok.status === 200 && !!callerTok.body.token, `HTTP ${callerTok.status} ${callerTok.body.error ?? ''}`);
if (callerTok.body.token) {
  const c = claims(callerTok.body.token);
  check('token is bound to this call room and user', c.video?.room === `nexo-call-${call.id}` && c.sub === (await alice.client.auth.getUser()).data.user.id);
  check('token is short-lived', c.exp - Math.floor(Date.now() / 1000) <= 2 * 3600 + 60);
  check('LiveKit URL is a wss:// endpoint', /^wss:\/\//.test(callerTok.body.url ?? ''), callerTok.body.url);
}

const calleeEarly = await tokenFor(bob, call.id);
check('callee cannot join before answering', calleeEarly.status === 409, `HTTP ${calleeEarly.status}`);

const outsider = await tokenFor(eve, call.id);
check('outsider gets no token', outsider.status === 404, `HTTP ${outsider.status}`);

const { error: ansErr } = await bob.client.rpc('answer_call', { call: call.id });
check('callee answers', !ansErr, ansErr?.message);
const calleeTok = await tokenFor(bob, call.id);
check('callee gets a token after answering', calleeTok.status === 200 && !!calleeTok.body.token, `HTTP ${calleeTok.status}`);

await alice.client.rpc('end_call', { call: call.id });
const afterEnd = await tokenFor(alice, call.id);
check('no tokens after the call ended', afterEnd.status === 409, `HTTP ${afterEnd.status}`);

console.log(failed ? `\n${failed} check(s) FAILED` : '\nall call checks passed');
process.exit(failed ? 1 : 0);
