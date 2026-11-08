const known: [RegExp, string][] = [
  [/invalid login credentials/i, 'Неверный email или пароль.'],
  [/email not confirmed/i, 'Подтвердите email: откройте письмо и перейдите по ссылке.'],
  [/user already registered/i, 'Этот email уже зарегистрирован.'],
  [/password should be at least/i, 'Пароль слишком короткий (минимум 8 символов).'],
  [/rate limit|too many/i, 'Слишком много запросов. Подождите немного.'],
  [/network request failed|failed to fetch|fetch failed/i, 'Нет соединения с сервером.'],
  [/profiles_username_key|duplicate key.*username/i, 'Этот username уже занят.'],
  [/username_check|violates check constraint "profiles_username/i, 'Username: 3–24 символа, латиница, цифры и _.'],
  [/row-level security/i, 'Действие недоступно: пользователь заблокирован или у вас нет доступа к этому чату.'],
  [/blocked/i,'Переписка недоступна: пользователь заблокирован.'],
  [/user not found/i, 'Пользователь не найден.'],
  [/jwt expired|invalid jwt/i, 'Сессия истекла. Войдите снова.'],
];

export const humanError = (e: unknown): string => {
  const msg = e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : String(e);
  for (const [re, text] of known) if (re.test(msg)) return text;
  return 'Что-то пошло не так. Попробуйте ещё раз.';
};
