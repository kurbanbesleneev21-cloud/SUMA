-- Storage policy tests for migration 0003 (needs a storage.objects table with RLS).
\set ON_ERROR_STOP 1
begin;
insert into auth.users (id, raw_user_meta_data) values
  ('20000000-0000-0000-0000-00000000000a', '{"username":"st_alice"}'),
  ('20000000-0000-0000-0000-00000000000b', '{"username":"st_bob"}'),
  ('20000000-0000-0000-0000-00000000000e', '{"username":"st_eve"}');
create temp table ctx (chat uuid);
grant all on ctx to authenticated;
create function pg_temp.as_user(uid text) returns void language sql as $$ select set_config('request.jwt.claim.sub', uid, false); $$;
set role authenticated;

select pg_temp.as_user('20000000-0000-0000-0000-00000000000a');
insert into ctx select public.create_direct_chat('20000000-0000-0000-0000-00000000000b');
insert into storage.objects (bucket_id, name) select 'attachments', chat || '/file1' from ctx;
do $$ begin
  begin
    insert into storage.objects (bucket_id, name) values ('attachments', '00000000-0000-0000-0000-000000000000/x');
    raise exception 'FAIL: upload into foreign chat folder';
  exception when insufficient_privilege then null; end;
  begin
    insert into storage.objects (bucket_id, name) values ('attachments', 'not-a-uuid/x');
    raise exception 'FAIL: upload outside chat folder';
  exception when insufficient_privilege then null; end;
  raise notice 'PASS: uploads only into own chat folders';
end $$;

select pg_temp.as_user('20000000-0000-0000-0000-00000000000b');
do $$ begin
  if (select count(*) from storage.objects where bucket_id = 'attachments') <> 1 then raise exception 'FAIL: member cannot see file'; end if;
  delete from storage.objects where bucket_id = 'attachments';
  raise notice 'PASS: member sees file';
end $$;

select pg_temp.as_user('20000000-0000-0000-0000-00000000000e');
do $$ begin
  if exists (select 1 from storage.objects where bucket_id = 'attachments') then raise exception 'FAIL: outsider sees file'; end if;
  raise notice 'PASS: outsider cannot see file';
end $$;

reset role;
do $$ begin
  if (select count(*) from storage.objects where bucket_id = 'attachments') <> 1 then raise exception 'FAIL: non-uploader deleted the file'; end if;
  raise notice 'PASS: only uploader can delete';
end $$;
set role authenticated;
select pg_temp.as_user('20000000-0000-0000-0000-00000000000a');
delete from storage.objects where bucket_id = 'attachments';
reset role;
do $$ begin
  if exists (select 1 from storage.objects where bucket_id = 'attachments') then raise exception 'FAIL: uploader could not delete'; end if;
  raise notice 'PASS: uploader can delete';
end $$;
rollback;
