-- Security tests for migration 0004 (calls).
\set ON_ERROR_STOP 1
begin;
insert into auth.users (id, raw_user_meta_data) values
  ('30000000-0000-0000-0000-00000000000a', '{"username":"c_alice"}'),
  ('30000000-0000-0000-0000-00000000000b', '{"username":"c_bob"}'),
  ('30000000-0000-0000-0000-00000000000e', '{"username":"c_eve"}');
create temp table ctx (chat uuid, call uuid);
grant all on ctx to authenticated;
create function pg_temp.as_user(uid text) returns void language sql as $$ select set_config('request.jwt.claim.sub', uid, false); $$;
set role authenticated;

select pg_temp.as_user('30000000-0000-0000-0000-00000000000a');
insert into ctx (chat) select public.create_direct_chat('30000000-0000-0000-0000-00000000000b');
update ctx set call = (public.start_call((select chat from ctx), true, 'ENCRYPTED-KEY')).id;
do $$ begin
  if (select status from public.calls where id = (select call from ctx)) <> 'ringing' then raise exception 'FAIL: call not ringing'; end if;
  begin
    insert into public.calls (chat_id, caller_id, callee_id) values ((select chat from ctx), auth.uid(), '30000000-0000-0000-0000-00000000000b');
    raise exception 'FAIL: direct insert into calls';
  exception when insufficient_privilege then null; end;
  raise notice 'PASS: call started via RPC only';
  perform public.answer_call((select call from ctx));
  raise exception 'FAIL: caller answered own call';
exception when raise_exception then
  if sqlerrm like 'FAIL%' then raise; end if;
  raise notice 'PASS: caller cannot answer own call';
end $$;

-- Eve sees nothing and cannot touch the call.
select pg_temp.as_user('30000000-0000-0000-0000-00000000000e');
do $$ begin
  if exists (select 1 from public.calls) then raise exception 'FAIL: outsider sees call'; end if;
  if exists (select 1 from public.my_calls()) then raise exception 'FAIL: outsider history leaks'; end if;
  perform public.end_call((select call from ctx));
  begin
    perform public.start_call((select chat from ctx), false, null);
    raise exception 'FAIL: outsider started call in foreign chat';
  exception when raise_exception then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;
  raise notice 'PASS: outsider cannot see, end or start calls';
end $$;
reset role;
do $$ begin
  if (select status from public.calls where id = (select call from ctx)) <> 'ringing' then raise exception 'FAIL: outsider ended the call'; end if;
end $$;
set role authenticated;

-- Bob sees the encrypted key, answers; a second call to busy Bob is marked busy.
select pg_temp.as_user('30000000-0000-0000-0000-00000000000b');
do $$ begin
  if (select key_for_callee from public.calls where id = (select call from ctx)) <> 'ENCRYPTED-KEY' then raise exception 'FAIL: callee cannot read key envelope'; end if;
  if (select status from public.answer_call((select call from ctx))) <> 'active' then raise exception 'FAIL: answer'; end if;
  raise notice 'PASS: callee answers';
end $$;

select pg_temp.as_user('30000000-0000-0000-0000-00000000000a');
do $$
declare st text;
begin
  st := (public.start_call((select chat from ctx), false, 'K2')).status;
  if st <> 'busy' then raise exception 'FAIL: expected busy, got %', st; end if;
  raise notice 'PASS: busy line detected';
end $$;

-- Ending: active call becomes ended, history shows it for both.
select public.end_call((select call from ctx));
do $$ begin
  if (select status from public.calls where id = (select call from ctx)) <> 'ended' then raise exception 'FAIL: end'; end if;
  if (select count(*) from public.my_calls()) < 2 then raise exception 'FAIL: history'; end if;
  raise notice 'PASS: end call and history';
end $$;

-- Privacy: Bob refuses calls from everyone.
select pg_temp.as_user('30000000-0000-0000-0000-00000000000b');
update public.user_settings set who_can_call = 'nobody';
select pg_temp.as_user('30000000-0000-0000-0000-00000000000a');
do $$ begin
  begin
    perform public.start_call((select chat from ctx), false, null);
    raise exception 'FAIL: call allowed despite who_can_call=nobody';
  exception when raise_exception then
    if sqlerrm not like 'privacy%' then raise; end if;
  end;
  raise notice 'PASS: who_can_call enforced';
end $$;

-- Decline flow.
select pg_temp.as_user('30000000-0000-0000-0000-00000000000b');
update public.user_settings set who_can_call = 'everyone';
select pg_temp.as_user('30000000-0000-0000-0000-00000000000a');
update ctx set call = (public.start_call((select chat from ctx), false, 'K3')).id;
select pg_temp.as_user('30000000-0000-0000-0000-00000000000b');
select public.decline_call((select call from ctx));
do $$ begin
  if (select status from public.calls where id = (select call from ctx)) <> 'declined' then raise exception 'FAIL: decline'; end if;
  raise notice 'PASS: callee declines';
end $$;

reset role;
rollback;
