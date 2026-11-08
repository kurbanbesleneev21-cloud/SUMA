-- NEXO: initial schema. Run once in Supabase SQL Editor (or `supabase db push`).

create extension if not exists pgcrypto;

-- ============ profiles ============
create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  username     text not null unique check (username ~ '^[a-z0-9_]{3,24}$'),
  display_name text not null check (char_length(display_name) between 1 and 64),
  bio          text not null default '' check (char_length(bio) <= 300),
  avatar_url   text,
  public_key   text check (public_key is null or char_length(public_key) = 44),
  last_seen_at timestamptz,
  created_at   timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles readable by signed-in users" on public.profiles
  for select to authenticated using (true);

create policy "users update own profile" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- Profile row is created server-side from sign-up metadata, so it works with email confirmation on.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  uname text := lower(coalesce(new.raw_user_meta_data->>'username', ''));
begin
  if uname !~ '^[a-z0-9_]{3,24}$' then
    uname := 'user_' || substr(replace(new.id::text, '-', ''), 1, 12);
  end if;
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    uname,
    left(coalesce(nullif(new.raw_user_meta_data->>'display_name', ''), uname), 64)
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.username_available(name text) returns boolean
language sql stable security definer set search_path = public as $$
  select not exists (select 1 from public.profiles where username = lower(name));
$$;
grant execute on function public.username_available(text) to anon, authenticated;

-- ============ blocks ============
create table public.user_blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
alter table public.user_blocks enable row level security;
create policy "see own blocks" on public.user_blocks
  for select to authenticated using (blocker_id = auth.uid());
create policy "create own blocks" on public.user_blocks
  for insert to authenticated with check (blocker_id = auth.uid());
create policy "delete own blocks" on public.user_blocks
  for delete to authenticated using (blocker_id = auth.uid());

create or replace function public.is_blocked_between(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.user_blocks
    where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a)
  );
$$;

-- ============ chats ============
create table public.chats (
  id              uuid primary key default gen_random_uuid(),
  is_group        boolean not null default false,
  title           text check (title is null or char_length(title) between 1 and 64),
  created_by      uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);

create table public.chat_members (
  chat_id      uuid not null references public.chats(id) on delete cascade,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  role         text not null default 'member' check (role in ('owner', 'admin', 'member')),
  joined_at    timestamptz not null default now(),
  last_read_at timestamptz not null default now(),
  primary key (chat_id, user_id)
);
create index chat_members_user_idx on public.chat_members(user_id);

-- SECURITY DEFINER avoids RLS recursion when policies need membership checks.
create or replace function public.is_chat_member(c uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.chat_members where chat_id = c and user_id = auth.uid());
$$;

alter table public.chats enable row level security;
alter table public.chat_members enable row level security;

create policy "members see chat" on public.chats
  for select to authenticated using (public.is_chat_member(id));
create policy "members see co-members" on public.chat_members
  for select to authenticated using (public.is_chat_member(chat_id));

-- Chats and memberships are only created through validated RPCs.
revoke insert, update, delete on public.chats, public.chat_members from anon, authenticated;

create or replace function public.create_direct_chat(other uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  cid uuid;
begin
  if me is null then raise exception 'not authenticated'; end if;
  if other = me then raise exception 'cannot chat with yourself'; end if;
  if not exists (select 1 from public.profiles where id = other) then
    raise exception 'user not found';
  end if;
  if public.is_blocked_between(me, other) then raise exception 'blocked'; end if;

  select c.id into cid
  from public.chats c
  join public.chat_members a on a.chat_id = c.id and a.user_id = me
  join public.chat_members b on b.chat_id = c.id and b.user_id = other
  where not c.is_group
  limit 1;
  if cid is not null then return cid; end if;

  insert into public.chats (is_group, created_by) values (false, me) returning id into cid;
  insert into public.chat_members (chat_id, user_id, role) values (cid, me, 'member'), (cid, other, 'member');
  return cid;
end $$;
grant execute on function public.create_direct_chat(uuid) to authenticated;

create or replace function public.mark_chat_read(c uuid) returns void
language sql security definer set search_path = public as $$
  update public.chat_members set last_read_at = now()
  where chat_id = c and user_id = auth.uid();
$$;
grant execute on function public.mark_chat_read(uuid) to authenticated;

-- ============ messages ============
-- Server stores only ciphertext. The plaintext never leaves the device.
create table public.messages (
  id            uuid primary key default gen_random_uuid(),
  chat_id       uuid not null references public.chats(id) on delete cascade,
  sender_id     uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  ciphertext    text not null check (char_length(ciphertext) <= 16000),
  nonce         text not null check (char_length(nonce) = 32),
  sender_key    text not null check (char_length(sender_key) = 44),
  recipient_key text not null check (char_length(recipient_key) = 44),
  reply_to      uuid references public.messages(id) on delete set null,
  created_at    timestamptz not null default now(),
  edited_at     timestamptz,
  deleted_at    timestamptz
);
create index messages_chat_created_idx on public.messages(chat_id, created_at desc);

alter table public.messages enable row level security;

create policy "members read messages" on public.messages
  for select to authenticated using (public.is_chat_member(chat_id));

create policy "members send messages" on public.messages
  for insert to authenticated with check (
    sender_id = auth.uid()
    and public.is_chat_member(chat_id)
    and not exists (
      select 1 from public.chat_members m
      where m.chat_id = messages.chat_id and m.user_id <> auth.uid()
        and public.is_blocked_between(auth.uid(), m.user_id)
    )
  );

create policy "senders edit own messages" on public.messages
  for update to authenticated using (sender_id = auth.uid()) with check (sender_id = auth.uid());

revoke delete on public.messages from anon, authenticated;

create or replace function public.messages_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if (select count(*) from public.messages
        where sender_id = new.sender_id and created_at > now() - interval '10 seconds') >= 20 then
      raise exception 'rate limit: too many messages';
    end if;
    update public.chats set last_message_at = new.created_at where id = new.chat_id;
  elsif tg_op = 'UPDATE' then
    if new.chat_id <> old.chat_id or new.sender_id <> old.sender_id or new.created_at <> old.created_at then
      raise exception 'immutable fields';
    end if;
  end if;
  return new;
end $$;

create trigger messages_guard_ins before insert on public.messages
  for each row execute function public.messages_guard();
create trigger messages_guard_upd before update on public.messages
  for each row execute function public.messages_guard();

-- ============ chat list ============
create or replace function public.my_chats()
returns table (
  chat_id uuid,
  is_group boolean,
  title text,
  last_message_at timestamptz,
  unread_count bigint,
  peer_id uuid,
  peer_username text,
  peer_display_name text,
  peer_avatar_url text,
  peer_last_seen_at timestamptz,
  last_sender_id uuid,
  last_ciphertext text,
  last_nonce text,
  last_sender_key text,
  last_recipient_key text,
  last_deleted boolean
)
language sql stable security definer set search_path = public as $$
  select c.id, c.is_group, c.title, c.last_message_at,
    (select count(*) from public.messages x
       where x.chat_id = c.id and x.sender_id <> auth.uid()
         and x.deleted_at is null and x.created_at > me.last_read_at),
    p.id, p.username, p.display_name, p.avatar_url, p.last_seen_at,
    lm.sender_id, lm.ciphertext, lm.nonce, lm.sender_key, lm.recipient_key, lm.deleted_at is not null
  from public.chat_members me
  join public.chats c on c.id = me.chat_id
  left join lateral (
    select pr.* from public.chat_members o
    join public.profiles pr on pr.id = o.user_id
    where o.chat_id = c.id and o.user_id <> auth.uid()
    limit 1
  ) p on not c.is_group
  left join lateral (
    select m.* from public.messages m
    where m.chat_id = c.id
    order by m.created_at desc
    limit 1
  ) lm on true
  where me.user_id = auth.uid()
  order by c.last_message_at desc;
$$;
grant execute on function public.my_chats() to authenticated;

-- ============ account deletion ============
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  delete from auth.users where id = auth.uid();
end $$;
grant execute on function public.delete_my_account() to authenticated;

-- Only signed-in users may call the helpers below; anon gets nothing.
revoke execute on function public.is_chat_member(uuid) from anon;
revoke execute on function public.is_blocked_between(uuid, uuid) from anon;
revoke all on public.profiles, public.chats, public.chat_members, public.messages, public.user_blocks from anon;

-- ============ realtime ============
alter publication supabase_realtime add table public.messages, public.chat_members;
