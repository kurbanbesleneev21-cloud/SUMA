delete from public.chats where id in (select chat_id from public.chat_members m join public.profiles p on p.id = m.user_id where p.username in ('qa_alice','qa_bob'));
delete from public.contacts where owner_id in (select id from public.profiles where username in ('qa_alice','qa_bob'));
update public.user_settings set who_can_message = 'everyone', last_seen_visibility = 'everyone', online_visibility = 'everyone', read_receipts = true where user_id in (select id from public.profiles where username in ('qa_alice','qa_bob'));
