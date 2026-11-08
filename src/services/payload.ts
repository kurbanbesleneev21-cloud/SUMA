// Plaintext structure of a message, encrypted end-to-end as a whole.
// Attachment keys live here, so the server never sees them.

export type AttachmentKind = 'image' | 'video' | 'file';

export interface AttachmentRef {
  id: string;
  kind: AttachmentKind;
  path: string;
  key: string;
  name: string;
  mime: string;
  size: number;
  w?: number;
  h?: number;
  dur?: number;
  thumb?: { path: string; key: string; w: number; h: number };
}

export interface Payload {
  text: string;
  att: AttachmentRef[];
}

const MARK = '{"nx":1';
export const MAX_ATTACHMENTS = 10;

export const encodePayload = (p: Payload) => {
  if (!p.att.length) return JSON.stringify({ nx: 1, t: p.text });
  return JSON.stringify({ nx: 1, t: p.text, a: p.att });
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const PATH = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[A-Za-z0-9_-]{8,64}$/;
const KEY = /^[A-Za-z0-9+/]{43}=$/;
const MIME = /^[a-z0-9.+-]+\/[a-z0-9.+-]+$/i;

const num = (v: unknown, max: number) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= max ? v : undefined);

// File names come from the other device: strip path separators and control characters.
export const safeFileName = (name: string) =>
  name
    .replace(/[\u0000-\u001f\u007f/\\]/g, '_')
    .replace(/^\.+/, '_')
    .slice(0, 120) || 'file';

export const extensionOf = (name: string) => {
  const m = /\.([A-Za-z0-9]{1,8})$/.exec(name);
  return m ? m[1].toLowerCase() : '';
};

const parseRef = (raw: unknown, chatId: string): AttachmentRef | null => {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== 'string' || !/^[A-Za-z0-9_-]{8,64}$/.test(r.id)) return null;
  if (r.kind !== 'image' && r.kind !== 'video' && r.kind !== 'file') return null;
  if (typeof r.path !== 'string' || !PATH.test(r.path) || !r.path.startsWith(`${chatId}/`)) return null;
  if (typeof r.key !== 'string' || !KEY.test(r.key)) return null;
  const size = num(r.size, 2 ** 31);
  if (size === undefined) return null;
  const ref: AttachmentRef = {
    id: r.id,
    kind: r.kind,
    path: r.path,
    key: r.key,
    name: safeFileName(typeof r.name === 'string' ? r.name : 'file'),
    mime: typeof r.mime === 'string' && MIME.test(r.mime) ? r.mime.toLowerCase() : 'application/octet-stream',
    size,
    w: num(r.w, 20000),
    h: num(r.h, 20000),
    dur: num(r.dur, 24 * 3600),
  };
  const th = r.thumb as Record<string, unknown> | undefined;
  if (th && typeof th.path === 'string' && PATH.test(th.path) && th.path.startsWith(`${chatId}/`) && typeof th.key === 'string' && KEY.test(th.key)) {
    ref.thumb = { path: th.path, key: th.key, w: num(th.w, 20000) ?? 0, h: num(th.h, 20000) ?? 0 };
  }
  return ref;
};

// Messages from older app versions are plain text; new ones are JSON with an "nx" marker.
export const decodePayload = (plain: string, chatId: string): Payload => {
  if (!UUID.test(chatId) || !plain.startsWith(MARK)) return { text: plain, att: [] };
  try {
    const obj = JSON.parse(plain) as { t?: unknown; a?: unknown };
    const text = typeof obj.t === 'string' ? obj.t : '';
    const att = Array.isArray(obj.a) ? obj.a.slice(0, MAX_ATTACHMENTS).map((a) => parseRef(a, chatId)).filter((a): a is AttachmentRef => !!a) : [];
    return { text, att };
  } catch {
    return { text: plain, att: [] };
  }
};
