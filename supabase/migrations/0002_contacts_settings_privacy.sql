-- NEXO stage 1: contacts, user settings, privacy-aware presence, private per-chat preferences.
--
-- Rule for helper functions: anything that takes an arbitrary user id as "viewer"/"sender" is internal
-- (no EXECUTE for clients), otherwise a client could ask about other people's contacts or blocks.
-- Policies and clients only use helpers that read the caller from auth.uid().

-- ============ lock down 0001 helpers that take arbitrary ids ============
revoke execute on function public.is_blocked_between(uuid, uuid) from public, anon, authenticated;

-- ============ contacts ============
create table public.contacts (
  owner_id   uuid not null references public.profiles(id) on delete cascade,
  contact_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (owner_id, contact_id),
  check (owner_id <> contact_id)
);
alter table public.contacts enable row level security;
create policy "see own contacts" on public.contacts
  for select to authenticated using (owner_id = auth.uid());
create policy "add own contacts" on public.contacts
  for insert to authenticated with check (owner_id = auth.uid());
create policy "remove own contacts" on public.contacts
  for delete to authenticated using (owner_id = auth.uid());
revoke all on public.contacts from anon;
revoke update on public.contacts from authenticated;

create function public.is_contact_of(owner uuid, other uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.contacts where owner_id = owner and contact_id = other);
$$;

-- ============ settings ============
create table public.user_settings (
  user_id               uuid primary key references public.profiles(id) on delete cascade,
  last_seen_visibility  text not null default 'everyone' check (last_seen_visibility in ('everyone', 'contacts', 'nobody')),
  online_visibility     text not null default 'everyone' check (online_visibility in ('everyone', 'contacts', 'nobody')),
  avatar_visibility     text not null default 'everyone' check (avatar_visibility in ('everyone', 'contacts', 'nobody')),
  who_can_message       text not null default 'everyone' check (who_can_message in ('everyone', 'contacts', 'nobody')),
  who_can_call          text not null default 'everyone' check (who_can_call in ('everyone', 'contacts', 'nobody')),
  who_can_add_to_groups text not null default 'everyone' check (who_can_add_to_groups in ('everyone', 'contacts', 'nobody')),
  read_receipts         boolean not null default true,
  notify_enabled        boolean not null default true,
  notify_private        boolean not null default true,
  notify_groups         boolean not null default true,
  notify_sound          boolean not null default true,
  notify_vibrate        boolean not null default true,
  notify_preview        boolean not null default false,
  updated_at            timestamptz not null default now()
);
alter table public.user_settings enable row level security;
create policy "read own settings" on public.user_settings
  for select to authenticated using (user_id = auth.uid());
create policy "update own settings" on public.user_settings
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke all on public.user_settings from anon;
revoke insert, delete on public.user_settings from authenticated;

insert into public.user_settings (user_id) select id from public.profiles on conflict do nothing;

create function public.setting_of(target uuid, field text) returns text
language plpgsql stable security definer set search_path = public as $$
declare v text;
begin
  execute format('select %I::text from public.user_settings where user_id = $1', field) into v using target;
  return coalesce(v, 'everyone');
end $$;

-- 'contacts' means the owner has the viewer in their contacts.
create function public.visible_to(rule text, owner uuid, viewer uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select owner = viewer
      or rule = 'everyone'
      or (rule = 'contacts' and public.is_contact_of(owner, viewer));
$$;

create function public.can_message(sender uuid, target uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select not public.is_blocked_between(sender, target)
     and public.visible_to(public.setting_of(target, 'who_can_message'), target, sender);
$$;

-- Caller-scoped variant used by RLS policies.
create function public.i_can_message(target uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.can_message(auth.uid(), target);
$$;

-- ============ presence (moved out of profiles so it can be hidden) ============
create table public.user_presence (
  user_id      uuid primary key references public.profiles(id) on delete cascade,
  last_seen_at timestamptz not null default now()
);
alter table public.user_presence enable row level security;
revoke all on public.user_presence from anon, authenticated;

insert into public.user_presence (user_id, last_seen_at)
select id, last_seen_at from public.profiles where last_seen_at is not null
on conflict do nothing;

alter table public.profiles drop column last_seen_at;

create function public.touch_presence() returns void
language sql security definer set search_path = public as $$
  insert into public.user_presence (user_id, last_seen_at)
  select auth.uid(), now() where auth.uid() is not null
  on conflict (user_id) do update set last_seen_at = excluded.last_seen_at;
$$;

create function public.presence_for(target uuid, viewer uuid)
returns table (is_online boolean, last_seen_at timestamptz)
language sql stable security definer set search_path = public as $$
  select
    case when target is null or public.is_blocked_between(target, viewer) then null
         when public.visible_to(public.setting_of(target, 'online_visibility'), target, viewer)
           then coalesce(p.last_seen_at > now() - interval '2 minutes', false)
    end,
    case when target is null or public.is_blocked_between(target, viewer) then null
         when public.visible_to(public.setting_of(target, 'last_seen_visibility'), target, viewer)
           then p.last_seen_at
    end
  from (select 1) one
  left join public.user_presence p on p.user_id = target;
$$;

create function public.get_presence(ids uuid[])
returns table (user_id uuid, is_online boolean, last_seen_at timestamptz)
language sql stable security definer set search_path = public as $$
  select t.id, pr.is_online, pr.last_seen_at
  from unnest(ids[1:200]) as t(id)
  cross join lateral public.presence_for(t.id, auth.uid()) pr
  where auth.uid() is not null;
$$;

-- Avatar respects the owner's avatar_visibility setting.
create function public.visible_avatar(target uuid) returns text
language sql stable security definer set search_path = public as $$
  select case when public.visible_to(public.setting_of(target, 'avatar_visibility'), target, auth.uid())
              and not public.is_blocked_between(target, auth.uid())
         then (select avatar_url from public.profiles where id = target) end;
$$;

-- New users get a settings row together with the profile.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  uname text := lower(coalesce(new.raw_user_meta_data->>'username', ''));
begin
  if uname !~ '^[a-z0-9_]{3,24}$' then
    uname := 'user_' || substr(replace(new.id::text, '-', ''), 1, 12);
  end if;
  insert into public.profiles (id, username, display_name)
  values (new.id, uname, left(coalesce(nullif(new.raw_user_meta_data->>'display_name', ''), uname), 64));
  insert into public.user_settings (user_id) values (new.id);
  return new;
end $$;

-- ============ private per-chat preferences (never visible to other members) ============
create table public.chat_prefs (
  chat_id     uuid not null,
  user_id     uuid not null,
  pinned_at   timestamptz,
  archived_at timestamptz,
  muted_until timestamptz,
  cleared_at  timestamptz,
  primary key (chat_id, user_id),
  foreign key (chat_id, user_id) references public.chat_members(chat_id, user_id) on delete cascade
);
alter table public.chat_prefs enable row level security;
create policy "own chat prefs" on public.chat_prefs
  for select to authenticated using (user_id = auth.uid());
revoke all on public.chat_prefs from anon, authenticated;
grant select on public.chat_prefs to authenticated;

create function public.set_chat_prefs(c uuid, pinned boolean default null, archived boolean default null, muted_until timestamptz default null, unmute boolean default false)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_chat_member(c) then raise exception 'not a member'; end if;
  insert into public.chat_prefs (chat_id, user_id) values (c, auth.uid()) on conflict do nothing;
  update public.chat_prefs set
    pinned_at   = case when pinned is null then pinned_at when pinned then now() else null end,
    archived_at = case when archived is null then archived_at when archived then now() else null end,
    muted_until = case when unmute then null when set_chat_prefs.muted_until is not null then set_chat_prefs.muted_until else chat_prefs.muted_until end
  where chat_id = c and user_id = auth.uid();
end $$;

-- "Delete chat for me": hides history up to now; the chat reappears when a new message arrives.
create function public.clear_chat_for_me(c uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_chat_member(c) then raise exception 'not a member'; end if;
  insert into public.chat_prefs (chat_id, user_id, cleared_at) values (c, auth.uid(), now())
  on conflict (chat_id, user_id) do update set cleared_at = now(), pinned_at = null, archived_at = null;
  update public.chat_members set last_read_at = now() where chat_id = c and user_id = auth.uid();
end $$;

create function public.my_cleared_at(c uuid) returns timestamptz
language sql stable security definer set search_path = public as $$
  select cleared_at from public.chat_prefs where chat_id = c and user_id = auth.uid();
$$;

drop policy "members read messages" on public.messages;
create policy "members read messages" on public.messages
  for select to authenticated using (
    public.is_chat_member(chat_id)
    and created_at > coalesce(public.my_cleared_at(chat_id), '-infinity'::timestamptz)
  );

-- Sending respects blocks and the recipient's "who can message me" setting.
drop policy "members send messages" on public.messages;
create policy "members send messages" on public.messages
  for insert to authenticated with check (
    sender_id = auth.uid()
    and public.is_chat_member(chat_id)
    and not exists (
      select 1 from public.chat_members m
      where m.chat_id = messages.chat_id and m.user_id <> auth.uid()
        and not public.i_can_message(m.user_id)
    )
  );

create or replace function public.create_direct_chat(other uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  cid uuid;
begin
  if me is null then raise exception 'not authenticated'; end if;
  if other = me then raise exception 'cannot chat with yourself'; end if;
  if not exists (select 1 from public.profiles where id = other) then raise exception 'user not found'; end if;
  if public.is_blocked_between(me, other) then raise exception 'blocked'; end if;

  select c.id into cid
  from public.chats c
  join public.chat_members a on a.chat_id = c.id and a.user_id = me
  join public.chat_members b on b.chat_id = c.id and b.user_id = other
  where not c.is_group
  limit 1;
  if cid is not null then return cid; end if;

  if not public.can_message(me, other) then raise exception 'privacy: user does not accept messages'; end if;

  insert into public.chats (is_group, created_by) values (false, me) returning id into cid;
  insert into public.chat_members (chat_id, user_id, role) values (cid, me, 'member'), (cid, other, 'member');
  return cid;
end $$;

-- Read receipts: when disabled, others see no read marker from this user.
create function public.peer_read_at(c uuid, peer uuid) returns timestamptz
language sql stable security definer set search_path = public as $$
  select case when public.is_chat_member(c) and coalesce((select read_receipts from public.user_settings where user_id = peer), true)
         then (select last_read_at from public.chat_members where chat_id = c and user_id = peer) end;
$$;

-- ============ chat list ============
drop function public.my_chats();
create function public.my_chats()
returns table (
  chat_id uuid,
  is_group boolean,
  title text,
  last_message_at timestamptz,
  unread_count bigint,
  pinned_at timestamptz,
  archived_at timestamptz,
  muted_until timestamptz,
  peer_id uuid,
  peer_username text,
  peer_display_name text,
  peer_avatar_url text,
  peer_is_online boolean,
  peer_last_seen_at timestamptz,
  peer_last_read_at timestamptz,
  last_message_id uuid,
  last_sender_id uuid,
  last_created_at timestamptz,
  last_ciphertext text,
  last_nonce text,
  last_sender_key text,
  last_recipient_key text,
  last_deleted boolean
)
language sql stable security definer set search_path = public as $$
  select c.id, c.is_group, c.title, c.last_message_at,
    (select count(*) from public.messages x
       where x.chat_id = c.id and x.sender_id <> auth.uid() and x.deleted_at is null
         and x.created_at > greatest(me.last_read_at, coalesce(cp.cleared_at, '-infinity'::timestamptz))),
    cp.pinned_at, cp.archived_at, cp.muted_until,
    peer.id, peer.username, peer.display_name, public.visible_avatar(peer.id),
    pres.is_online, pres.last_seen_at, public.peer_read_at(c.id, peer.id),
    lm.id, lm.sender_id, lm.created_at, lm.ciphertext, lm.nonce, lm.sender_key, lm.recipient_key, lm.deleted_at is not null
  from public.chat_members me
  join public.chats c on c.id = me.chat_id
  left join public.chat_prefs cp on cp.chat_id = me.chat_id and cp.user_id = me.user_id
  left join lateral (
    select pf.id, pf.username, pf.display_name from public.chat_members o
    join public.profiles pf on pf.id = o.user_id
    where o.chat_id = c.id and o.user_id <> auth.uid()
    limit 1
  ) peer on not c.is_group
  left join lateral public.presence_for(peer.id, auth.uid()) pres on true
  left join lateral (
    select m.* from public.messages m
    where m.chat_id = c.id and m.created_at > coalesce(cp.cleared_at, '-infinity'::timestamptz)
    order by m.created_at desc
    limit 1
  ) lm on true
  where me.user_id = auth.uid()
    and (cp.cleared_at is null or c.last_message_at > cp.cleared_at)
  order by cp.pinned_at desc nulls last, c.last_message_at desc;
$$;

-- ============ grants ============
-- Internal helpers (take arbitrary user ids): no client access.
revoke execute on function public.is_contact_of(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.setting_of(uuid, text) from public, anon, authenticated;
revoke execute on function public.visible_to(text, uuid, uuid) from public, anon, authenticated;
revoke execute on function public.can_message(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.presence_for(uuid, uuid) from public, anon, authenticated;

-- Caller-scoped functions: signed-in users only.
revoke execute on function public.i_can_message(uuid) from public, anon;
revoke execute on function public.my_cleared_at(uuid) from public, anon;
revoke execute on function public.touch_presence() from public, anon;
revoke execute on function public.get_presence(uuid[]) from public, anon;
revoke execute on function public.visible_avatar(uuid) from public, anon;
revoke execute on function public.set_chat_prefs(uuid, boolean, boolean, timestamptz, boolean) from public, anon;
revoke execute on function public.clear_chat_for_me(uuid) from public, anon;
revoke execute on function public.peer_read_at(uuid, uuid) from public, anon;
revoke execute on function public.my_chats() from public, anon;
grant execute on function public.i_can_message(uuid), public.my_cleared_at(uuid), public.touch_presence(),
  public.get_presence(uuid[]), public.visible_avatar(uuid),
  public.set_chat_prefs(uuid, boolean, boolean, timestamptz, boolean), public.clear_chat_for_me(uuid),
  public.peer_read_at(uuid, uuid), public.my_chats() to authenticated;
