import { currentLocale, t } from '@/i18n';

const tag = () => (currentLocale() === 'en' ? 'en-GB' : 'ru-RU');

const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
const yesterdayOf = (d: Date) => {
  const y = new Date(d);
  y.setDate(d.getDate() - 1);
  return y;
};

export const timeShort = (iso: string) => new Date(iso).toLocaleTimeString(tag(), { hour: '2-digit', minute: '2-digit' });

export const chatTime = (iso: string) => {
  const d = new Date(iso);
  const now = new Date();
  if (sameDay(d, now)) return timeShort(iso);
  if (sameDay(d, yesterdayOf(now))) return t('time.yesterday');
  if (now.getTime() - d.getTime() < 6 * 86400000) return d.toLocaleDateString(tag(), { weekday: 'short' });
  return d.toLocaleDateString(tag(), { day: '2-digit', month: '2-digit' });
};

export const dayLabel = (iso: string) => {
  const d = new Date(iso);
  const now = new Date();
  if (sameDay(d, now)) return t('time.today');
  if (sameDay(d, yesterdayOf(now))) return t('time.yesterdayCap');
  return d.toLocaleDateString(tag(), { day: 'numeric', month: 'long', year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric' });
};

export const fullDate = (iso: string) => new Date(iso).toLocaleDateString(tag(), { day: 'numeric', month: 'long', year: 'numeric' });

export interface Presence {
  is_online: boolean | null;
  last_seen_at: string | null;
}

export const presenceLabel = (p: Presence | null | undefined) => {
  if (p?.is_online) return t('presence.online');
  if (p?.last_seen_at) return t('presence.lastSeen', { time: chatTime(p.last_seen_at) });
  return t('presence.recently');
};

export const USERNAME_RE = /^[a-z0-9_]{3,24}$/;
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
