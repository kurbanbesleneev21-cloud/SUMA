// Issues a short-lived LiveKit access token for a call the signed-in user takes part in.
// LIVEKIT_URL / LIVEKIT_API_KEY / LIVEKIT_API_SECRET are Edge Function secrets and never reach the app.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { AccessToken } from 'npm:livekit-server-sdk@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'unauthorized' }, 401);

  let callId: unknown;
  try {
    callId = (await req.json())?.call_id;
  } catch {
    return json({ error: 'bad_request' }, 400);
  }
  if (typeof callId !== 'string' || !UUID.test(callId)) return json({ error: 'bad_request' }, 400);

  // Act as the caller: RLS on public.calls only returns calls this user participates in.
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return json({ error: 'unauthorized' }, 401);
  const uid = userData.user.id;

  const lkUrl = Deno.env.get('LIVEKIT_URL');
  const lkKey = Deno.env.get('LIVEKIT_API_KEY');
  const lkSecret = Deno.env.get('LIVEKIT_API_SECRET');
  if (!lkUrl || !lkKey || !lkSecret) return json({ error: 'livekit_not_configured' }, 503);

  const { data: call } = await supabase.from('calls').select('id, caller_id, callee_id, status, video').eq('id', callId).maybeSingle();
  if (!call) return json({ error: 'not_found' }, 404);
  const isCaller = call.caller_id === uid;
  const allowed = call.status === 'active' || (call.status === 'ringing' && isCaller);
  if (!allowed) return json({ error: 'call_not_active', status: call.status }, 409);

  const token = new AccessToken(lkKey, lkSecret, { identity: uid, ttl: '2h' });
  token.addGrant({
    room: `nexo-call-${call.id}`,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
    canPublishData: false,
    canUpdateOwnMetadata: false,
  });
  return json({ url: lkUrl, token: await token.toJwt() });
});
