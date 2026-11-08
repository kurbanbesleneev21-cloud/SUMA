-- Security tests for the NEXO schema. Run against a database with the migration applied
-- (and a Supabase-like auth schema). Every failed expectation raises an exception.
\set ON_ERROR_STOP 1
begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'alice@example.com', '{"username":"alice","display_name":"Alice"}'),
  ('00000000-0000-0000-0000-00000000000b', 'bob@example.com',   '{"username":"bob","display_name":"Bob"}'),
  ('00000000-0000-0000-0000-00000000000e', 'eve@example.com',   '{"username":"eve","display_name":"Eve"}'),
  ('00000000-0000-0000-0000-0000000000ff', 'bad@example.com',   '{"username":"Bad Name!"}');

create temp table ctx (chat uuid, msg uuid);
grant all on ctx to authenticated;

create function pg_temp.as_user(uid text) returns void language sql as $$
  select set_config('request.jwt.claim.sub', uid, false);
$$;

do $$ begin
  if (select username from public.profiles where id = '00000000-0000-0000-0000-0000000000ff') !~ '^user_' then
    raise exception 'FAIL: invalid username from metadata was not replaced';
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'email') then
    raise exception 'FAIL: profiles exposes email';
  end if;
  raise notice 'PASS: profiles created by trigger, no email column';
end $$;

set role authenticated;

-- Alice opens a chat with Bob and sends a message.
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
update public.profiles set public_key = repeat('A', 43) || '=' where id = auth.uid();
insert into ctx (chat) select public.create_direct_chat('00000000-0000-0000-0000-00000000000b');
do $$ begin
  if public.create_direct_chat('00000000-0000-0000-0000-00000000000b') <> (select chat from ctx) then
    raise exception 'FAIL: second create_direct_chat made a duplicate chat';
  end if;
  raise notice 'PASS: direct chat is reused';
end $$;
insert into public.messages (chat_id, ciphertext, nonce, sender_key, recipient_key)
select chat, 'CIPHERTEXT', repeat('n', 32), repeat('A', 43) || '=', repeat('B', 43) || '=' from ctx;
update ctx set msg = (select id from public.messages where ciphertext = 'CIPHERTEXT');

do $$ begin
  begin
    update public.profiles set display_name = 'hacked' where id = '00000000-0000-0000-0000-00000000000b';
  end;
  if (select display_name from public.profiles where id = '00000000-0000-0000-0000-00000000000b') = 'hacked' then
    raise exception 'FAIL: Alice changed Bob''s profile';
  end if;
  raise notice 'PASS: cannot edit another user''s profile';
end $$;

do $$ begin
  begin
    insert into public.chats (is_group) values (false);
    raise exception 'FAIL: direct insert into chats allowed';
  exception when insufficient_privilege then
    raise notice 'PASS: chats only via RPC';
  end;
  begin
    insert into public.chat_members (chat_id, user_id) select chat, '00000000-0000-0000-0000-00000000000e' from ctx;
    raise exception 'FAIL: could add a member directly';
  exception when insufficient_privilege then
    raise notice 'PASS: memberships only via RPC';
  end;
end $$;

-- Eve is not a member: she must see and do nothing in Alice/Bob's chat.
select pg_temp.as_user('00000000-0000-0000-0000-00000000000e');
do $$ begin
  if exists (select 1 from public.messages) then raise exception 'FAIL: Eve reads foreign messages'; end if;
  if exists (select 1 from public.chats) then raise exception 'FAIL: Eve sees foreign chats'; end if;
  if exists (select 1 from public.chat_members) then raise exception 'FAIL: Eve sees foreign members'; end if;
  if exists (select 1 from public.my_chats()) then raise exception 'FAIL: my_chats leaks to Eve'; end if;
  raise notice 'PASS: outsider cannot read messages, chats, members';
  begin
    insert into public.messages (chat_id, ciphertext, nonce, sender_key, recipient_key)
    select chat, 'x', repeat('n', 32), repeat('E', 43) || '=', repeat('B', 43) || '=' from ctx;
    raise exception 'FAIL: Eve wrote into a foreign chat';
  exception when insufficient_privilege then
    raise notice 'PASS: outsider cannot write into chat';
  end;
  update public.messages set ciphertext = 'tampered' where id = (select msg from ctx);
  raise notice 'PASS: outsider update silently affects nothing';
  begin
    delete from public.chat_members;
    raise exception 'FAIL: outsider could delete memberships';
  exception when insufficient_privilege then
    raise notice 'PASS: memberships cannot be deleted by clients';
  end;
end $$;

-- Bob is a member: he reads the ciphertext and has one unread message.
-- (Whole test is one transaction, so now() is constant; move Bob's read marker into the past.)
reset role;
update public.chat_members set last_read_at = now() - interval '1 minute' where user_id = '00000000-0000-0000-0000-00000000000b';
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
do $$ begin
  if (select ciphertext from public.messages where id = (select msg from ctx)) <> 'CIPHERTEXT' then
    raise exception 'FAIL: Bob cannot read, or Eve tampered the message';
  end if;
  if (select unread_count from public.my_chats() limit 1) <> 1 then raise exception 'FAIL: unread count'; end if;
  if (select last_ciphertext from public.my_chats() limit 1) <> 'CIPHERTEXT' then raise exception 'FAIL: last message preview'; end if;
  perform public.mark_chat_read((select chat from ctx));
  if (select unread_count from public.my_chats() limit 1) <> 0 then raise exception 'FAIL: mark read'; end if;
  raise notice 'PASS: member reads, unread count and preview work';
  update public.messages set ciphertext = 'bob-edit' where id = (select msg from ctx);
  if (select ciphertext from public.messages where id = (select msg from ctx)) <> 'CIPHERTEXT' then
    raise exception 'FAIL: Bob edited Alice''s message';
  end if;
  raise notice 'PASS: cannot edit another member''s message';
  begin
    insert into public.messages (chat_id, sender_id, ciphertext, nonce, sender_key, recipient_key)
    select chat, '00000000-0000-0000-0000-00000000000a', 'spoof', repeat('n', 32), repeat('B', 43) || '=', repeat('A', 43) || '=' from ctx;
    raise exception 'FAIL: Bob sent a message as Alice';
  exception when insufficient_privilege then
    raise notice 'PASS: cannot spoof sender';
  end;
end $$;

-- Bob blocks Alice: neither side can send anymore.
insert into public.user_blocks (blocker_id, blocked_id) values ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000a');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
do $$ begin
  if exists (select 1 from public.user_blocks) then raise exception 'FAIL: Alice sees Bob''s block list'; end if;
  begin
    insert into public.messages (chat_id, ciphertext, nonce, sender_key, recipient_key)
    select chat, 'x', repeat('n', 32), repeat('A', 43) || '=', repeat('B', 43) || '=' from ctx;
    raise exception 'FAIL: blocked user could send';
  exception when insufficient_privilege then
    raise notice 'PASS: blocked user cannot send';
  end;
  begin
    perform public.create_direct_chat('00000000-0000-0000-0000-00000000000b');
    raise exception 'FAIL: blocked user could open chat';
  exception when raise_exception then
    if sqlerrm not like '%blocked%' then raise; end if;
    raise notice 'PASS: blocked user cannot open chat';
  end;
end $$;

-- Rate limit: Alice spams Eve.
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
do $$
declare c uuid := public.create_direct_chat('00000000-0000-0000-0000-00000000000e');
begin
  for i in 1..19 loop
    insert into public.messages (chat_id, ciphertext, nonce, sender_key, recipient_key)
    values (c, 'x', repeat('n', 32), repeat('A', 43) || '=', repeat('E', 43) || '=');
  end loop;
  begin
    insert into public.messages (chat_id, ciphertext, nonce, sender_key, recipient_key)
    values (c, 'x', repeat('n', 32), repeat('A', 43) || '=', repeat('E', 43) || '=');
    raise exception 'FAIL: rate limit not enforced';
  exception when raise_exception then
    if sqlerrm not like '%rate limit%' then raise; end if;
    raise notice 'PASS: rate limit enforced';
  end;
end $$;

-- Anonymous visitors see nothing.
reset role;
set role anon;
do $$ begin
  begin
    perform 1 from public.profiles limit 1;
    raise exception 'FAIL: anon can read profiles';
  exception when insufficient_privilege then
    raise notice 'PASS: anon cannot read profiles';
  end;
end $$;

-- Account deletion removes the user and their data.
reset role;
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000e');
select public.delete_my_account();
reset role;
do $$ begin
  if exists (select 1 from auth.users where id = '00000000-0000-0000-0000-00000000000e') then raise exception 'FAIL: auth user not deleted'; end if;
  if exists (select 1 from public.profiles where id = '00000000-0000-0000-0000-00000000000e') then raise exception 'FAIL: profile not deleted'; end if;
  raise notice 'PASS: account deletion cascades';
end $$;

rollback;
