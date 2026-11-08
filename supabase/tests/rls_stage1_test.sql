-- Security tests for migration 0002 (contacts, settings, presence privacy, chat prefs).
\set ON_ERROR_STOP 1
begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('10000000-0000-0000-0000-00000000000a', 'a1@example.com', '{"username":"s1_alice"}'),
  ('10000000-0000-0000-0000-00000000000b', 'b1@example.com', '{"username":"s1_bob"}'),
  ('10000000-0000-0000-0000-00000000000e', 'e1@example.com', '{"username":"s1_eve"}');

create temp table ctx (chat uuid);
grant all on ctx to authenticated;
create function pg_temp.as_user(uid text) returns void language sql as $$
  select set_config('request.jwt.claim.sub', uid, false);
$$;

do $$ begin
  if (select count(*) from public.user_settings where user_id::text like '10000000%') <> 3 then
    raise exception 'FAIL: settings row not created on sign-up';
  end if;
  raise notice 'PASS: settings created for new users';
end $$;

set role authenticated;

-- Internal helpers are not callable by clients.
select pg_temp.as_user('10000000-0000-0000-0000-00000000000e');
do $$
declare fn text;
begin
  foreach fn in array array[
    'select public.is_contact_of(''10000000-0000-0000-0000-00000000000a'', ''10000000-0000-0000-0000-00000000000b'')',
    'select public.can_message(''10000000-0000-0000-0000-00000000000a'', ''10000000-0000-0000-0000-00000000000b'')',
    'select public.is_blocked_between(''10000000-0000-0000-0000-00000000000a'', ''10000000-0000-0000-0000-00000000000b'')',
    'select * from public.presence_for(''10000000-0000-0000-0000-00000000000a'', ''10000000-0000-0000-0000-00000000000a'')',
    'select public.setting_of(''10000000-0000-0000-0000-00000000000a'', ''who_can_message'')'
  ] loop
    begin
      execute fn;
      raise exception 'FAIL: internal helper callable: %', fn;
    exception when insufficient_privilege then null;
    end;
  end loop;
  raise notice 'PASS: internal privacy helpers are not callable by clients';
  if exists (select 1 from public.user_settings where user_id <> auth.uid()) then
    raise exception 'FAIL: can read someone else''s settings';
  end if;
  begin
    perform 1 from public.user_presence;
    raise exception 'FAIL: presence table readable';
  exception when insufficient_privilege then null;
  end;
  raise notice 'PASS: settings and presence tables are private';
end $$;

-- Alice chats with Bob, is online, pins the chat.
select pg_temp.as_user('10000000-0000-0000-0000-00000000000a');
select public.touch_presence();
insert into ctx (chat) select public.create_direct_chat('10000000-0000-0000-0000-00000000000b');
select public.set_chat_prefs((select chat from ctx), pinned => true);
insert into public.messages (chat_id, ciphertext, nonce, sender_key, recipient_key)
select chat, 'C1', repeat('n', 32), repeat('A', 43) || '=', repeat('B', 43) || '=' from ctx;

select pg_temp.as_user('10000000-0000-0000-0000-00000000000b');
do $$ begin
  if not (select is_online from public.get_presence(array['10000000-0000-0000-0000-00000000000a'::uuid])) then
    raise exception 'FAIL: online status not visible by default';
  end if;
  if exists (select 1 from public.chat_prefs) then raise exception 'FAIL: Bob sees Alice''s chat prefs'; end if;
  if (select pinned_at from public.my_chats() where chat_id = (select chat from ctx)) is not null then
    raise exception 'FAIL: Alice''s pin leaked into Bob''s list';
  end if;
  raise notice 'PASS: presence visible by default; chat prefs are private';
end $$;

-- Alice hides last seen and online from everyone.
select pg_temp.as_user('10000000-0000-0000-0000-00000000000a');
update public.user_settings set last_seen_visibility = 'nobody', online_visibility = 'nobody', read_receipts = false;
do $$ begin
  if (select pinned_at from public.my_chats() where chat_id = (select chat from ctx)) is null then
    raise exception 'FAIL: pin not stored';
  end if;
  raise notice 'PASS: pin stored for owner';
end $$;
select public.mark_chat_read((select chat from ctx));

select pg_temp.as_user('10000000-0000-0000-0000-00000000000b');
do $$ begin
  if exists (select 1 from public.get_presence(array['10000000-0000-0000-0000-00000000000a'::uuid]) where is_online is not null or last_seen_at is not null) then
    raise exception 'FAIL: hidden presence leaked';
  end if;
  if (select peer_last_seen_at from public.my_chats() where chat_id = (select chat from ctx)) is not null then
    raise exception 'FAIL: hidden last seen leaked via my_chats';
  end if;
  if public.peer_read_at((select chat from ctx), '10000000-0000-0000-0000-00000000000a') is not null then
    raise exception 'FAIL: read receipt shown although disabled';
  end if;
  raise notice 'PASS: hidden last seen / online / read receipts respected';
end $$;

-- Bob accepts messages only from contacts; Eve is not one.
update public.user_settings set who_can_message = 'contacts';
select pg_temp.as_user('10000000-0000-0000-0000-00000000000e');
do $$ begin
  begin
    perform public.create_direct_chat('10000000-0000-0000-0000-00000000000b');
    raise exception 'FAIL: non-contact opened chat';
  exception when raise_exception then
    if sqlerrm not like 'privacy%' then raise; end if;
  end;
  raise notice 'PASS: who_can_message=contacts blocks strangers';
end $$;

select pg_temp.as_user('10000000-0000-0000-0000-00000000000b');
insert into public.contacts (owner_id, contact_id) values (auth.uid(), '10000000-0000-0000-0000-00000000000e');
select pg_temp.as_user('10000000-0000-0000-0000-00000000000e');
do $$ begin
  if exists (select 1 from public.contacts) then raise exception 'FAIL: Eve sees Bob''s contact list'; end if;
  perform public.create_direct_chat('10000000-0000-0000-0000-00000000000b');
  raise notice 'PASS: contact can open chat; contact lists are private';
end $$;

-- Bob turns messages off completely: Alice cannot write even in the existing chat.
select pg_temp.as_user('10000000-0000-0000-0000-00000000000b');
update public.user_settings set who_can_message = 'nobody';
select pg_temp.as_user('10000000-0000-0000-0000-00000000000a');
do $$ begin
  begin
    insert into public.messages (chat_id, ciphertext, nonce, sender_key, recipient_key)
    select chat, 'C2', repeat('n', 32), repeat('A', 43) || '=', repeat('B', 43) || '=' from ctx;
    raise exception 'FAIL: message sent to user who disabled messages';
  exception when insufficient_privilege then null;
  end;
  raise notice 'PASS: who_can_message=nobody enforced in existing chat';
end $$;

-- Alice deletes the chat for herself: hidden for her, untouched for Bob.
select public.clear_chat_for_me((select chat from ctx));
do $$ begin
  if exists (select 1 from public.my_chats() where chat_id = (select chat from ctx)) then raise exception 'FAIL: cleared chat still listed'; end if;
  if exists (select 1 from public.messages where chat_id = (select chat from ctx)) then raise exception 'FAIL: cleared history still readable'; end if;
  begin
    perform public.set_chat_prefs('10000000-0000-0000-0000-000000000000', pinned => true);
    raise exception 'FAIL: prefs set on foreign chat';
  exception when raise_exception then
    if sqlerrm <> 'not a member' then raise; end if;
  end;
  raise notice 'PASS: delete-for-me hides chat and history; prefs only for own chats';
end $$;
select pg_temp.as_user('10000000-0000-0000-0000-00000000000b');
do $$ begin
  if not exists (select 1 from public.messages where chat_id = (select chat from ctx)) then raise exception 'FAIL: Bob lost history'; end if;
  raise notice 'PASS: other member keeps history';
end $$;

reset role;
rollback;
