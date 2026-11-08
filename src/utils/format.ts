const ONLINE_WINDOW_MS = 2 * 60 * 1000;

export const isOnline = (lastSeen: string | null | undefined) =>
  !!lastSeen && Date.now() - new Date(lastSeen).getTime() < ONLINE_WINDOW_MS;

export const timeShort = (iso: string) =>
  new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

export const chatTime = (iso: string) => {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return timeShort(iso);
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'вчера';
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
};

export const dayLabel = (iso: string) => {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return 'Сегодня';
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Вчера';
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric' });
};

export const lastSeenLabel = (lastSeen: string | null | undefined) => {
  if (isOnline(lastSeen)) return 'в сети';
  if (!lastSeen) return 'не в сети';
  return `был(а) ${chatTime(lastSeen)}`;
};

export const USERNAME_RE = /^[a-z0-9_]{3,24}$/;
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
