import nacl from 'tweetnacl';
import util from 'tweetnacl-util';
import { sb } from '@/lib/supabase';
import { decryptText, encryptText, KeyPair } from '@/crypto/box';
import '@/crypto/keys';

export type CallStatus = 'ringing' | 'active' | 'ended' | 'declined' | 'missed' | 'busy' | 'cancelled' | 'failed';

export interface CallRow {
  id: string;
  chat_id: string;
  caller_id: string;
  callee_id: string;
  video: boolean;
  status: CallStatus;
  key_for_callee: string | null;
  created_at: string;
  answered_at: string | null;
  ended_at: string | null;
}

export interface CallHistoryItem {
  id: string;
  chat_id: string;
  video: boolean;
  status: CallStatus;
  outgoing: boolean;
  created_at: string;
  answered_at: string | null;
  ended_at: string | null;
  peer_id: string;
  peer_username: string;
  peer_display_name: string;
}

export const RING_TIMEOUT_MS = 45_000;

// Media keys live only in memory on the two phones; the server stores the callee's copy encrypted.
const mediaKeys = new Map<string, Uint8Array>();
export const mediaKeyFor = (callId: string) => mediaKeys.get(callId) ?? null;

export async function startCall(p: { chatId: string; video: boolean; keys: KeyPair; peerPublicKey: string }): Promise<CallRow> {
  const mediaKey = nacl.randomBytes(32);
  const envelope = encryptText(util.encodeBase64(mediaKey), p.keys, p.peerPublicKey);
  const { data, error } = await sb().rpc('start_call', { c: p.chatId, with_video: p.video, encrypted_key: JSON.stringify(envelope) });
  if (error) throw error;
  const row = data as CallRow;
  if (row.status === 'ringing') mediaKeys.set(row.id, mediaKey);
  return row;
}

// Callee side: recovers the media key; null means it was not encrypted for this device.
export function unwrapMediaKey(call: CallRow, keys: KeyPair): Uint8Array | null {
  if (!call.key_for_callee) return null;
  try {
    const plain = decryptText(JSON.parse(call.key_for_callee), keys);
    if (!plain) return null;
    const key = util.decodeBase64(plain);
    if (key.length !== 32) return null;
    mediaKeys.set(call.id, key);
    return key;
  } catch {
    return null;
  }
}

export async function answerCall(callId: string): Promise<CallRow> {
  const { data, error } = await sb().rpc('answer_call', { call: callId });
  if (error) throw error;
  return data as CallRow;
}

export async function declineCall(callId: string) {
  mediaKeys.delete(callId);
  const { error } = await sb().rpc('decline_call', { call: callId });
  if (error) throw error;
}

export async function endCall(callId: string, timedOut = false) {
  mediaKeys.delete(callId);
  const { error } = await sb().rpc('end_call', { call: callId, timed_out: timedOut });
  if (error) throw error;
}

export async function markPresence(callId: string, joined: boolean) {
  await sb().rpc('mark_call_presence', { call: callId, joined });
}

export async function getCall(callId: string): Promise<CallRow> {
  const { data, error } = await sb().from('calls').select('*').eq('id', callId).single();
  if (error) throw error;
  return data as CallRow;
}

export async function fetchCallHistory(): Promise<CallHistoryItem[]> {
  const { data, error } = await sb().rpc('my_calls', { lim: 200 });
  if (error) throw error;
  return (data ?? []) as CallHistoryItem[];
}

export class CallTokenError extends Error {
  constructor(public code: string) {
    super(code);
  }
}

export async function fetchCallToken(callId: string): Promise<{ url: string; token: string }> {
  const { data, error } = await sb().functions.invoke('livekit-token', { body: { call_id: callId } });
  if (error) {
    let code = 'unknown';
    try {
      const body = await (error as { context?: Response }).context?.json();
      code = body?.error ?? code;
    } catch {
      // keep generic code
    }
    throw new CallTokenError(code);
  }
  return data as { url: string; token: string };
}
