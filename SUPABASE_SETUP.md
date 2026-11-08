# Полная инструкция по настройке Supabase для NEXO

## Шаг 1: Создание Supabase проекта

1. Перейдите на [supabase.com](https://supabase.com)
2. Нажмите "Start your project"
3. Войдите или создайте аккаунт (можно через GitHub)
4. Нажмите "New Project"

### Заполнение формы

- **Name**: NEXO (или ваше имя проекта)
- **Database Password**: Установите безопасный пароль (сохраните его!)
- **Region**: Выберите регион ближайший к вам (например, Europe - Frankfurt)
- **Pricing**: Выберите "Free" для начала

5. Нажмите "Create new project"
6. Дождитесь инициализации проекта (5-10 минут)

## Шаг 2: Получение ключей

После создания проекта:

1. Перейдите в **Settings** → **API**
2. Скопируйте:
   - **Project URL** (EXPO_PUBLIC_SUPABASE_URL)
   - **anon public** (EXPO_PUBLIC_SUPABASE_ANON_KEY)

3. Создайте файл `.env.local` в корне проекта:

```bash
EXPO_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT-ID.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_KEY_HERE
```

## Шаг 3: Настройка базы данных

### Вариант 1: Автоматическая настройка (SQL Editor)

1. В Supabase перейдите в **SQL Editor**
2. Нажмите **New query**
3. Скопируйте и выполните следующий SQL код по порядку

### Вариант 2: Ручная настройка

Выполните все запросы из файла `SQL_SETUP.md` последовательно.

#### SQL код для базы данных:

```sql
-- Удаляем существующие таблицы (если есть)
DROP TABLE IF EXISTS public.group_chat_encryption_keys CASCADE;
DROP TABLE IF EXISTS public.user_devices CASCADE;
DROP TABLE IF EXISTS public.user_blocks CASCADE;
DROP TABLE IF EXISTS public.message_reactions CASCADE;
DROP TABLE IF EXISTS public.message_reads CASCADE;
DROP TABLE IF EXISTS public.message_attachments CASCADE;
DROP TABLE IF EXISTS public.messages CASCADE;
DROP TABLE IF EXISTS public.group_chat_members CASCADE;
DROP TABLE IF EXISTS public.group_chats CASCADE;
DROP TABLE IF EXISTS public.private_chats CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- === ТАБЛИЦЫ ===

-- Таблица профилей пользователей
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  avatar_url TEXT,
  status TEXT DEFAULT 'offline' CHECK (status IN ('online', 'offline', 'away')),
  status_message TEXT,
  public_key TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Таблица приватных чатов
CREATE TABLE public.private_chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user1_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user2_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user1_id, user2_id),
  CHECK (user1_id != user2_id)
);

-- Таблица групповых чатов
CREATE TABLE public.group_chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  avatar_url TEXT,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Таблица участников групп
CREATE TABLE public.group_chat_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_chat_id UUID NOT NULL REFERENCES public.group_chats(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  is_admin BOOLEAN DEFAULT FALSE,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(group_chat_id, user_id)
);

-- Таблица сообщений
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID,
  group_chat_id UUID,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  encrypted_content TEXT,
  message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'video', 'audio', 'file')),
  is_edited BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMP WITH TIME ZONE,
  reply_to_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (chat_id) REFERENCES public.private_chats(id) ON DELETE CASCADE,
  FOREIGN KEY (group_chat_id) REFERENCES public.group_chats(id) ON DELETE CASCADE,
  CHECK (
    (chat_id IS NOT NULL AND group_chat_id IS NULL) OR
    (chat_id IS NULL AND group_chat_id IS NOT NULL)
  )
);

-- Таблица прочитанных сообщений
CREATE TABLE public.message_reads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  read_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(message_id, user_id)
);

-- Таблица реакций на сообщения
CREATE TABLE public.message_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(message_id, user_id, emoji)
);

-- Таблица вложений
CREATE TABLE public.message_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  file_url TEXT NOT NULL,
  encrypted_file_key TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Таблица заблокированных пользователей
CREATE TABLE public.user_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, blocked_user_id),
  CHECK (user_id != blocked_user_id)
);

-- Таблица устройств пользователей
CREATE TABLE public.user_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  public_key TEXT NOT NULL,
  device_name TEXT NOT NULL,
  device_type TEXT NOT NULL,
  last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, device_id)
);

-- Таблица ключей шифрования для групп
CREATE TABLE public.group_chat_encryption_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_chat_id UUID NOT NULL REFERENCES public.group_chats(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  encrypted_key TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(group_chat_id, user_id)
);

-- === ИНДЕКСЫ ===

CREATE INDEX idx_profiles_username ON public.profiles(username);
CREATE INDEX idx_profiles_email ON public.profiles(email);
CREATE INDEX idx_private_chats_user1 ON public.private_chats(user1_id);
CREATE INDEX idx_private_chats_user2 ON public.private_chats(user2_id);
CREATE INDEX idx_group_chats_created_by ON public.group_chats(created_by);
CREATE INDEX idx_group_chat_members_group ON public.group_chat_members(group_chat_id);
CREATE INDEX idx_group_chat_members_user ON public.group_chat_members(user_id);
CREATE INDEX idx_messages_chat ON public.messages(chat_id);
CREATE INDEX idx_messages_group_chat ON public.messages(group_chat_id);
CREATE INDEX idx_messages_sender ON public.messages(sender_id);
CREATE INDEX idx_messages_created_at ON public.messages(created_at);
CREATE INDEX idx_message_reads_message ON public.message_reads(message_id);
CREATE INDEX idx_message_reads_user ON public.message_reads(user_id);
CREATE INDEX idx_message_reactions_message ON public.message_reactions(message_id);
CREATE INDEX idx_message_attachments_message ON public.message_attachments(message_id);
CREATE INDEX idx_user_blocks_user ON public.user_blocks(user_id);
CREATE INDEX idx_user_devices_user ON public.user_devices(user_id);
CREATE INDEX idx_group_chat_encryption_keys_group ON public.group_chat_encryption_keys(group_chat_id);
CREATE INDEX idx_group_chat_encryption_keys_user ON public.group_chat_encryption_keys(user_id);

-- === ROW LEVEL SECURITY ===

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE 
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

ALTER TABLE public.private_chats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their chats" ON public.private_chats FOR SELECT 
  USING (auth.uid() = user1_id OR auth.uid() = user2_id);
CREATE POLICY "Users can create chats" ON public.private_chats FOR INSERT 
  WITH CHECK (auth.uid() = user1_id OR auth.uid() = user2_id);

ALTER TABLE public.group_chats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view group chats they're in" ON public.group_chats FOR SELECT 
  USING (EXISTS (
    SELECT 1 FROM public.group_chat_members
    WHERE group_chat_id = id AND user_id = auth.uid()
  ));

ALTER TABLE public.group_chat_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view group members" ON public.group_chat_members FOR SELECT 
  USING (EXISTS (
    SELECT 1 FROM public.group_chat_members gcm
    WHERE gcm.group_chat_id = group_chat_id AND gcm.user_id = auth.uid()
  ));

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view messages in their chats" ON public.messages FOR SELECT 
  USING ((
    chat_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.private_chats pc
      WHERE pc.id = chat_id AND (pc.user1_id = auth.uid() OR pc.user2_id = auth.uid())
    )
  ) OR (
    group_chat_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.group_chat_members gcm
      WHERE gcm.group_chat_id = group_chat_id AND gcm.user_id = auth.uid()
    )
  ));

CREATE POLICY "Users can insert messages" ON public.messages FOR INSERT 
  WITH CHECK (sender_id = auth.uid() AND ((
    chat_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.private_chats pc
      WHERE pc.id = chat_id AND (pc.user1_id = auth.uid() OR pc.user2_id = auth.uid())
    )
  ) OR (
    group_chat_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.group_chat_members gcm
      WHERE gcm.group_chat_id = group_chat_id AND gcm.user_id = auth.uid()
    )
  )));

CREATE POLICY "Users can update their own messages" ON public.messages FOR UPDATE 
  USING (auth.uid() = sender_id) WITH CHECK (auth.uid() = sender_id);

ALTER TABLE public.message_reads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view read status" ON public.message_reads FOR SELECT 
  USING (EXISTS (
    SELECT 1 FROM public.messages m
    WHERE m.id = message_id AND ((
      m.chat_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.private_chats pc
        WHERE pc.id = m.chat_id AND (pc.user1_id = auth.uid() OR pc.user2_id = auth.uid())
      )
    ) OR (
      m.group_chat_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.group_chat_members gcm
        WHERE gcm.group_chat_id = m.group_chat_id AND gcm.user_id = auth.uid()
      )
    ))
  ));

ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view reactions" ON public.message_reactions FOR SELECT 
  USING (EXISTS (
    SELECT 1 FROM public.messages m
    WHERE m.id = message_id AND ((
      m.chat_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.private_chats pc
        WHERE pc.id = m.chat_id AND (pc.user1_id = auth.uid() OR pc.user2_id = auth.uid())
      )
    ) OR (
      m.group_chat_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.group_chat_members gcm
        WHERE gcm.group_chat_id = m.group_chat_id AND gcm.user_id = auth.uid()
      )
    ))
  ));

ALTER TABLE public.message_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view attachments" ON public.message_attachments FOR SELECT 
  USING (EXISTS (
    SELECT 1 FROM public.messages m
    WHERE m.id = message_id AND ((
      m.chat_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.private_chats pc
        WHERE pc.id = m.chat_id AND (pc.user1_id = auth.uid() OR pc.user2_id = auth.uid())
      )
    ) OR (
      m.group_chat_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.group_chat_members gcm
        WHERE gcm.group_chat_id = m.group_chat_id AND gcm.user_id = auth.uid()
      )
    ))
  ));

ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own blocks" ON public.user_blocks FOR SELECT 
  USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own blocks" ON public.user_blocks FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

ALTER TABLE public.user_devices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their devices" ON public.user_devices FOR SELECT 
  USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their devices" ON public.user_devices FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

ALTER TABLE public.group_chat_encryption_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own keys" ON public.group_chat_encryption_keys FOR SELECT 
  USING (auth.uid() = user_id);
```

## Шаг 4: Создание Storage Buckets

1. В Supabase перейдите в **Storage**
2. Нажмите **Create bucket**

### Создаём аватары bucket

- **Name**: avatars
- **Public/Private**: Public
- **Files to disallow**: (оставить пусто)
- Нажмите **Create bucket**

### Создаём медиа bucket

- **Name**: messages
- **Public/Private**: Private
- **Files to disallow**: (оставить пусто)
- Нажмите **Create bucket**

## Шаг 5: Настройка Email подтверждения (опционально)

1. Перейдите в **Authentication** → **Providers**
2. Найдите **Email**
3. Убедитесь, что включены:
   - ✅ Enable Email provider
   - ✅ Confirm email
   - ✅ Email change confirmation

## Шаг 6: Настройка Rate Limiting (опционально)

1. Перейдите в **Authentication** → **Email Templates**
2. Отредактируйте шаблоны подтверждения письма (опционально)

## Шаг 7: Проверка конфигурации

1. В Supabase Dashboard перейдите в **Database** → **Tables**
2. Убедитесь, что все таблицы созданы:
   - profiles
   - private_chats
   - group_chats
   - group_chat_members
   - messages
   - message_reads
   - message_reactions
   - message_attachments
   - user_blocks
   - user_devices
   - group_chat_encryption_keys

3. Перейдите в **Storage** → **Buckets**
4. Убедитесь, что созданы:
   - avatars (Public)
   - messages (Private)

## Шаг 8: Переменные окружения

Создайте файл `.env.local` в корне проекта:

```bash
EXPO_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT-ID.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_KEY_HERE
```

Замените:
- `YOUR-PROJECT-ID` на ID вашего Supabase проекта
- `YOUR_ANON_KEY_HERE` на анон ключ из Settings → API

## Тестирование подключения

Запустите приложение и попробуйте:

```bash
npm run dev
```

Попробуйте создать аккаунт - если это сработает, значит Supabase правильно настроен!

## Резервные копии и восстановление

Supabase автоматически создает резервные копии. Для ручного создания:

1. Перейдите в **Settings** → **Database** → **Backups**
2. Нажмите **Create backup**

## Мониторинг и метрики

Следить за использованием:

1. **Settings** → **Usage**
2. Просмотр:
   - Хранилище базы данных
   - Трансфер данных
   - Количество пользователей

## Безопасность

### Рекомендации

1. Никогда не используйте SERVICE_ROLE_KEY в приложении
2. Используйте только ANON_KEY
3. Row Level Security (RLS) включен по умолчанию
4. Регулярно проверяйте логи доступа

### API Keys

- **ANON_KEY**: Используется в приложении (безопасно)
- **SERVICE_ROLE_KEY**: Используется только на сервере (секретно!)
- **JWT_SECRET**: Не раскрывайте

## Troubleshooting

### Проблема: "Invalid API key"

**Решение**: Проверьте, что скопирован правильный ключ из Settings → API

### Проблема: "Policy issue"

**Решение**: Убедитесь, что RLS политики правильно установлены

### Проблема: "Table not found"

**Решение**: Выполните SQL код для создания таблиц еще раз

## Дополнительные ресурсы

- [Supabase Documentation](https://supabase.com/docs)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Row Level Security Guide](https://supabase.com/docs/guides/auth/row-level-security)

---

**Последнее обновление**: 2026-11-08
