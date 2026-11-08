import { t, TKey } from '@/i18n';

const known: [RegExp, TKey][] = [
  [/invalid login credentials/i, 'errors.badCredentials'],
  [/email not confirmed/i, 'errors.emailNotConfirmed'],
  [/user already registered/i, 'errors.emailTaken'],
  [/password should be at least/i, 'errors.passwordShort'],
  [/rate limit|too many/i, 'errors.rateLimit'],
  [/network request failed|failed to fetch|fetch failed/i, 'errors.network'],
  [/profiles_username_key|duplicate key.*username/i, 'errors.usernameTaken'],
  [/username_check|violates check constraint "profiles_username/i, 'errors.usernameFormat'],
  [/privacy: user does not accept/i, 'errors.privacyMessages'],
  [/row-level security/i, 'errors.forbidden'],
  [/blocked/i, 'errors.blocked'],
  [/user not found/i, 'errors.userNotFound'],
  [/jwt expired|invalid jwt/i, 'errors.sessionExpired'],
  [/PGRST20[25]|schema cache/i, 'errors.serverNotSetUp'],
];

export const humanError = (e: unknown): string => {
  const msg =
    e instanceof Error
      ? e.message
      : typeof e === 'object' && e && 'message' in e
        ? `${String((e as { message: unknown }).message)} ${String((e as { code?: unknown }).code ?? '')}`
        : String(e);
  for (const [re, key] of known) if (re.test(msg)) return t(key);
  return t('errors.generic');
};
