import { Directory, DownloadTask, File, Paths, UploadTask } from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import * as VideoThumbnails from 'expo-video-thumbnails';
import sodium from 'react-native-libsodium';
import util from 'tweetnacl-util';
import { sb, serverConfig } from '@/lib/supabase';
import { decryptFile, encryptFile, workDir } from '@/crypto/fileCrypto';
import { AttachmentKind, AttachmentRef, extensionOf, safeFileName } from './payload';
import { t } from '@/i18n';

const BUCKET = 'attachments';
// Supabase free plan caps a single object at 50 MB; encryption adds ~16 bytes per MiB.
export const MAX_FILE_BYTES = 49 * 1024 * 1024;
const BLOCKED_EXTENSIONS = new Set(['apk', 'aab', 'exe', 'msi', 'bat', 'cmd', 'com', 'scr', 'vbs', 'ps1', 'jar', 'dex', 'ipa']);
const IMAGE_MAX_SIDE = 2048;

export class AttachmentError extends Error {
  name = 'AttachmentError';
}

export interface PickedItem {
  uri: string;
  kind: AttachmentKind;
  name: string;
  mime: string;
  size: number;
  w?: number;
  h?: number;
  dur?: number;
}

export const validatePicked = (item: PickedItem) => {
  if (BLOCKED_EXTENSIONS.has(extensionOf(item.name))) throw new AttachmentError(t('attach.blockedType', { name: item.name }));
  if (item.size > MAX_FILE_BYTES) throw new AttachmentError(t('attach.tooLarge', { name: item.name, max: 49 }));
};

const randomId = () => util.encodeBase64(sodium.randombytes_buf(18)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const authHeaders = async () => {
  const { data } = await sb().auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('JWT expired');
  return { Authorization: `Bearer ${token}`, apikey: serverConfig().anonKey };
};

const objectUrl = (path: string, authenticated = false) =>
  `${serverConfig().url}/storage/v1/object/${authenticated ? 'authenticated/' : ''}${BUCKET}/${path}`;

async function uploadEncrypted(chatId: string, file: File, onProgress?: (fraction: number) => void) {
  const path = `${chatId}/${randomId()}`;
  const task = new UploadTask(file, objectUrl(path), {
    httpMethod: 'POST',
    headers: { ...(await authHeaders()), 'Content-Type': 'application/octet-stream', 'x-upsert': 'false' },
  });
  const sub = task.addListener('progress', (p) => p.totalBytes > 0 && onProgress?.(p.bytesSent / p.totalBytes));
  try {
    const res = await task.uploadAsync();
    if (res.status < 200 || res.status >= 300) throw new AttachmentError(t('attach.uploadFailed', { status: res.status }));
  } finally {
    sub.remove();
    task.release();
  }
  return path;
}

// Shrinks photos unless the user asked for the original; videos and files are sent as-is.
export async function prepareImage(item: PickedItem, original: boolean): Promise<PickedItem> {
  if (original) return item;
  const longSide = Math.max(item.w ?? 0, item.h ?? 0);
  const resize = longSide > IMAGE_MAX_SIDE ? ((item.w ?? 0) >= (item.h ?? 0) ? { width: IMAGE_MAX_SIDE } : { height: IMAGE_MAX_SIDE }) : null;
  const out = await ImageManipulator.manipulateAsync(item.uri, resize ? [{ resize }] : [], { compress: 0.82, format: ImageManipulator.SaveFormat.JPEG });
  const size = new File(out.uri).size ?? item.size;
  const base = item.name.replace(/\.[^.]+$/, '');
  return { ...item, uri: out.uri, w: out.width, h: out.height, mime: 'image/jpeg', name: `${base || 'photo'}.jpg`, size };
}

async function videoThumbnail(uri: string) {
  const shot = await VideoThumbnails.getThumbnailAsync(uri, { time: 500, quality: 0.7 });
  const small = await ImageManipulator.manipulateAsync(shot.uri, [{ resize: { width: 480 } }], { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG });
  return small;
}

export interface UploadStep {
  stage: 'encrypting' | 'uploading';
  fraction: number;
}

// Encrypts and uploads one item; the plaintext stays only on this device (it is also placed in the
// media cache so the sender does not have to download its own file again).
export async function uploadAttachment(chatId: string, item: PickedItem, onStep: (s: UploadStep) => void): Promise<AttachmentRef> {
  validatePicked(item);
  const id = randomId();
  let thumb: AttachmentRef['thumb'];
  if (item.kind === 'video') {
    try {
      const shot = await videoThumbnail(item.uri);
      const encThumb = await encryptFile(shot.uri);
      const thumbPath = await uploadEncrypted(chatId, encThumb.file);
      encThumb.file.delete();
      thumb = { path: thumbPath, key: encThumb.key, w: shot.width, h: shot.height };
      cachePlaintext(shot.uri, { id, name: 'thumb.jpg' }, 'thumb');
    } catch {
      thumb = undefined;
    }
  }
  onStep({ stage: 'encrypting', fraction: 0 });
  const enc = await encryptFile(item.uri, (f) => onStep({ stage: 'encrypting', fraction: f }));
  try {
    const path = await uploadEncrypted(chatId, enc.file, (f) => onStep({ stage: 'uploading', fraction: f }));
    const ref: AttachmentRef = { id, kind: item.kind, path, key: enc.key, name: safeFileName(item.name), mime: item.mime, size: enc.plainSize, w: item.w, h: item.h, dur: item.dur, thumb };
    cachePlaintext(item.uri, ref, 'main');
    return ref;
  } finally {
    if (enc.file.exists) enc.file.delete();
  }
}

export async function deleteAttachmentObjects(refs: AttachmentRef[]) {
  const paths = refs.flatMap((r) => [r.path, ...(r.thumb ? [r.thumb.path] : [])]);
  if (paths.length) await sb().storage.from(BUCKET).remove(paths);
}

// ---------- local media cache (decrypted files, app-private) ----------

export const mediaDir = () => {
  const dir = new Directory(Paths.cache, 'nexo-media');
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
};

const cacheFile = (ref: Pick<AttachmentRef, 'id' | 'name'>, part: 'main' | 'thumb') => {
  const ext = part === 'thumb' ? 'jpg' : extensionOf(ref.name) || 'bin';
  return new File(mediaDir(), `${ref.id}${part === 'thumb' ? '-thumb' : ''}.${ext}`);
};

// Cache is an optimisation; on failure the file is simply downloaded again later.
function cachePlaintext(uri: string, ref: Pick<AttachmentRef, 'id' | 'name'>, part: 'main' | 'thumb') {
  try {
    const dest = cacheFile(ref, part);
    if (!dest.exists) new File(uri).copy(dest).catch(() => {});
  } catch {
    // ignore
  }
}

export const cachedUri = (ref: AttachmentRef, part: 'main' | 'thumb' = 'main') => {
  const f = cacheFile(ref, part);
  return f.exists ? f.uri : null;
};

const inflight = new Map<string, Promise<string>>();

// Downloads the encrypted object, verifies and decrypts it into the media cache.
export function fetchDecrypted(ref: AttachmentRef, part: 'main' | 'thumb', onProgress?: (fraction: number) => void): Promise<string> {
  const dest = cacheFile(ref, part);
  if (dest.exists) return Promise.resolve(dest.uri);
  const k = `${ref.id}:${part}`;
  const existing = inflight.get(k);
  if (existing) return existing;
  const src = part === 'thumb' && ref.thumb ? ref.thumb : { path: ref.path, key: ref.key };
  const job = (async () => {
    const enc = new File(workDir(), `${randomId()}.enc`);
    const task = new DownloadTask(objectUrl(src.path, true), enc, { headers: await authHeaders() });
    const sub = task.addListener('progress', (p) => p.totalBytes > 0 && onProgress?.(0.9 * (p.bytesWritten / p.totalBytes)));
    try {
      const got = await task.downloadAsync();
      if (!got || !enc.exists) throw new AttachmentError(t('attach.downloadFailed'));
      try {
        await decryptFile(enc, src.key, dest, (f) => onProgress?.(0.9 + 0.1 * f));
      } catch {
        throw new AttachmentError(t('attach.integrityFailed'));
      }
      return dest.uri;
    } finally {
      sub.remove();
      if (enc.exists) enc.delete();
    }
  })();
  inflight.set(k, job);
  job.finally(() => inflight.delete(k)).catch(() => {});
  return job;
}

const dirSize = (dir: Directory): number =>
  dir.exists ? dir.list().reduce((n, e) => n + (e instanceof Directory ? dirSize(e) : (e.size ?? 0)), 0) : 0;

export const cacheSize = () => dirSize(mediaDir()) + dirSize(workDir());

export const clearCache = () => {
  for (const d of [mediaDir(), workDir()]) if (d.exists) d.delete();
};

export const formatBytes = (n: number) => {
  if (n < 1024) return `${n} ${t('units.b')}`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} ${t('units.kb')}`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} ${t('units.mb')}`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} ${t('units.gb')}`;
};

export const formatDuration = (sec?: number) => {
  if (sec === undefined) return '';
  const s = Math.round(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
