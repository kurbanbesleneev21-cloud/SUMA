-- NEXO: encrypted attachments storage.
-- Files are encrypted on the device before upload; per-file keys travel only inside E2E-encrypted messages.
-- Object path: <chat_id>/<random id>. Only members of that chat can read or upload; only the uploader can delete.

insert into storage.buckets (id, name, public, file_size_limit)
values ('attachments', 'attachments', false, 52428800)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

create or replace function public.attachment_chat_member(object_name text) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare
  folder text := split_part(object_name, '/', 1);
begin
  if folder !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  return public.is_chat_member(folder::uuid);
end $$;
revoke execute on function public.attachment_chat_member(text) from public, anon;
grant execute on function public.attachment_chat_member(text) to authenticated;

create policy "nexo members read attachments" on storage.objects
  for select to authenticated
  using (bucket_id = 'attachments' and public.attachment_chat_member(name));

create policy "nexo members upload attachments" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'attachments' and public.attachment_chat_member(name));

create policy "nexo uploader deletes attachment" on storage.objects
  for delete to authenticated
  using (bucket_id = 'attachments' and owner_id = auth.uid()::text);
