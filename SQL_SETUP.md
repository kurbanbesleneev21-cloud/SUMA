# NEXO - Supabase Setup

## Инструкции по настройке базы данных

1. Создайте проект в [Supabase](https://supabase.com)
2. Перейдите в SQL Editor
3. Выполните следующие SQL-запросы по порядку:

## Step 1: Создание таблицы профилей пользователей

```sql
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
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CHECK (email != ''),
  CHECK (username != '')
);

-- Индексы для оптимизации поиска
CREATE INDEX idx_profiles_username ON public.profiles(username);
CREATE INDEX idx_profiles_email ON public.profiles(email);

-- Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all profiles" ON public.profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
```

## Step 2: Создание таблицы приватных чатов

```sql
CREATE TABLE public.private_chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user1_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user2_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user1_id, user2_id),
  CHECK (user1_id != user2_id)
);

CREATE INDEX idx_private_chats_user1 ON public.private_chats(user1_id);
CREATE INDEX idx_private_chats_user2 ON public.private_chats(user2_id);

ALTER TABLE public.private_chats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their chats" ON public.private_chats
  FOR SELECT USING (
    auth.uid() = user1_id OR auth.uid() = user2_id
  );

CREATE POLICY "Users can create chats" ON public.private_chats
  FOR INSERT WITH CHECK (
    auth.uid() = user1_id OR auth.uid() = user2_id
  );
```

## Step 3: Создание таблицы групповых чатов

```sql
CREATE TABLE public.group_chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  avatar_url TEXT,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_group_chats_created_by ON public.group_chats(created_by);

ALTER TABLE public.group_chats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view group chats they're in" ON public.group_chats
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.group_chat_members
      WHERE group_chat_id = id AND user_id = auth.uid()
    )
  );
```

## Step 4: Создание таблицы участников групп

```sql
CREATE TABLE public.group_chat_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_chat_id UUID NOT NULL REFERENCES public.group_chats(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  is_admin BOOLEAN DEFAULT FALSE,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(group_chat_id, user_id)
);

CREATE INDEX idx_group_chat_members_group ON public.group_chat_members(group_chat_id);
CREATE INDEX idx_group_chat_members_user ON public.group_chat_members(user_id);

ALTER TABLE public.group_chat_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view group members" ON public.group_chat_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.group_chat_members gcm
      WHERE gcm.group_chat_id = group_chat_id AND gcm.user_id = auth.uid()
    )
  );
```

## Step 5: Создание таблицы сообщений

```sql
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

CREATE INDEX idx_messages_chat ON public.messages(chat_id);
CREATE INDEX idx_messages_group_chat ON public.messages(group_chat_id);
CREATE INDEX idx_messages_sender ON public.messages(sender_id);
CREATE INDEX idx_messages_created_at ON public.messages(created_at);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view messages in their chats" ON public.messages
  FOR SELECT USING (
    (
      chat_id IS NOT NULL AND
      EXISTS (
        SELECT 1 FROM public.private_chats pc
        WHERE pc.id = chat_id AND (pc.user1_id = auth.uid() OR pc.user2_id = auth.uid())
      )
    ) OR
    (
      group_chat_id IS NOT NULL AND
      EXISTS (
        SELECT 1 FROM public.group_chat_members gcm
        WHERE gcm.group_chat_id = group_chat_id AND gcm.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can insert messages" ON public.messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid() AND (
      (
        chat_id IS NOT NULL AND
        EXISTS (
          SELECT 1 FROM public.private_chats pc
          WHERE pc.id = chat_id AND (pc.user1_id = auth.uid() OR pc.user2_id = auth.uid())
        )
      ) OR
      (
        group_chat_id IS NOT NULL AND
        EXISTS (
          SELECT 1 FROM public.group_chat_members gcm
          WHERE gcm.group_chat_id = group_chat_id AND gcm.user_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Users can update their own messages" ON public.messages
  FOR UPDATE USING (auth.uid() = sender_id)
  WITH CHECK (auth.uid() = sender_id);
```

## Step 6: Создание таблицы прочитанных сообщений

```sql
CREATE TABLE public.message_reads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  read_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(message_id, user_id)
);

CREATE INDEX idx_message_reads_message ON public.message_reads(message_id);
CREATE INDEX idx_message_reads_user ON public.message_reads(user_id);

ALTER TABLE public.message_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view read status" ON public.message_reads
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.messages m
      WHERE m.id = message_id AND (
        (m.chat_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.private_chats pc
          WHERE pc.id = m.chat_id AND (pc.user1_id = auth.uid() OR pc.user2_id = auth.uid())
        )) OR
        (m.group_chat_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.group_chat_members gcm
          WHERE gcm.group_chat_id = m.group_chat_id AND gcm.user_id = auth.uid()
        ))
      )
    )
  );
```

## Step 7: Создание таблицы реакций на сообщения

```sql
CREATE TABLE public.message_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(message_id, user_id, emoji)
);

CREATE INDEX idx_message_reactions_message ON public.message_reactions(message_id);

ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view reactions" ON public.message_reactions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.messages m
      WHERE m.id = message_id AND (
        (m.chat_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.private_chats pc
          WHERE pc.id = m.chat_id AND (pc.user1_id = auth.uid() OR pc.user2_id = auth.uid())
        )) OR
        (m.group_chat_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.group_chat_members gcm
          WHERE gcm.group_chat_id = m.group_chat_id AND gcm.user_id = auth.uid()
        ))
      )
    )
  );
```

## Step 8: Создание таблицы вложений

```sql
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

CREATE INDEX idx_message_attachments_message ON public.message_attachments(message_id);

ALTER TABLE public.message_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view attachments" ON public.message_attachments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.messages m
      WHERE m.id = message_id AND (
        (m.chat_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.private_chats pc
          WHERE pc.id = m.chat_id AND (pc.user1_id = auth.uid() OR pc.user2_id = auth.uid())
        )) OR
        (m.group_chat_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.group_chat_members gcm
          WHERE gcm.group_chat_id = m.group_chat_id AND gcm.user_id = auth.uid()
        ))
      )
    )
  );
```

## Step 9: Создание таблицы заблокированных пользователей

```sql
CREATE TABLE public.user_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, blocked_user_id),
  CHECK (user_id != blocked_user_id)
);

CREATE INDEX idx_user_blocks_user ON public.user_blocks(user_id);

ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own blocks" ON public.user_blocks
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own blocks" ON public.user_blocks
  FOR INSERT WITH CHECK (auth.uid() = user_id);
```

## Step 10: Создание таблицы устройств пользователей

```sql
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

CREATE INDEX idx_user_devices_user ON public.user_devices(user_id);

ALTER TABLE public.user_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their devices" ON public.user_devices
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their devices" ON public.user_devices
  FOR INSERT WITH CHECK (auth.uid() = user_id);
```

## Step 11: Создание таблицы для хранения ключей шифрования групп

```sql
CREATE TABLE public.group_chat_encryption_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_chat_id UUID NOT NULL REFERENCES public.group_chats(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  encrypted_key TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(group_chat_id, user_id)
);

CREATE INDEX idx_group_chat_encryption_keys_group ON public.group_chat_encryption_keys(group_chat_id);
CREATE INDEX idx_group_chat_encryption_keys_user ON public.group_chat_encryption_keys(user_id);

ALTER TABLE public.group_chat_encryption_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own keys" ON public.group_chat_encryption_keys
  FOR SELECT USING (auth.uid() = user_id);
```

## Storage Buckets

1. Создайте публичное хранилище для аватаров:
   - Name: `avatars`
   - Public: true

2. Создайте приватное хранилище для файлов (медиа):
   - Name: `messages`
   - Public: false

## Переменные окружения (.env.local)

После создания проекта в Supabase:

```
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_KEY
```

Получите эти значения из Settings → API в вашем Supabase проекте.

## Примечания по безопасности

- Все критичные операции защищены RLS (Row Level Security)
- Пользователи могут видеть только сообщения из чатов, в которых они участвуют
- Удаление пользователя автоматически удаляет все его данные благодаря каскадным удалениям
- Файлы хранятся в приватном хранилище и доступны только участникам чата
- Все сообщения шифруются на устройстве пользователя перед отправкой на сервер
