-- NEXO: 1:1 audio/video calls. Media goes through LiveKit; this schema handles signalling,
-- permissions and history. The media key is generated on the caller's phone and stored here only
-- encrypted to the callee's public key (key_for_callee), so neither Supabase nor LiveKit can read it.

create table public.calls (
  id             uuid primary key default gen_random_uuid(),
  chat_id        uuid not null references public.chats(id) on delete cascade,
  caller_id      uuid not null references public.profiles(id) on delete cascade,
  callee_id      uuid not null references public.profiles(id) on delete cascade,
  video          boolean not null default false,
  status         text not null default 'ringing'
                 check (status in ('ringing', 'active', 'ended', 'declined', 'missed', 'busy', 'cancelled', 'failed')),
  key_for_callee text check (key_for_callee is null or char_length(key_for_callee) <= 1000),
  created_at     timestamptz not null default now(),
  answered_at    timestamptz,
  ended_at       timestamptz,
  ended_by       uuid references public.profiles(id) on delete set null,
  check (caller_id <> callee_id)
);
create index calls_caller_idx on public.calls(caller_id, created_at desc);
create index calls_callee_idx on public.calls(callee_id, created_at desc);

create table public.call_participants (
  call_id   uuid not null references public.calls(id) on delete cascade,
  user_id   uuid not null references public.profiles(id) on delete cascade,
  role      text not null check (role in ('caller', 'callee')),
  joined_at timestamptz,
  left_at   timestamptz,
  primary key (call_id, user_id)
);

alter table public.calls enable row level security;
alter table public.call_participants enable row level security;
create policy "participants see call" on public.calls
  for select to authenticated using (auth.uid() in (caller_id, callee_id));
create policy "participants see call members" on public.call_participants
  for select to authenticated using (exists (select 1 from public.calls c where c.id = call_id and auth.uid() in (c.caller_id, c.callee_id)));
revoke all on public.calls, public.call_participants from anon;
revoke insert, update, delete on public.calls, public.call_participants from authenticated;

-- Calls left ringing (app killed, no answer) become missed after a minute.
create function public.expire_ringing_calls() returns void
language sql security definer set search_path = public as $$
  update public.calls set status = 'missed', ended_at = now()
  where status = 'ringing' and created_at < now() - interval '60 seconds';
$$;

create function public.start_call(c uuid, with_video boolean, encrypted_key text)
returns public.calls
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  peer uuid;
  row public.calls;
begin
  if me is null then raise exception 'not authenticated'; end if;
  if not public.is_chat_member(c) then raise exception 'not a member'; end if;
  if (select is_group from public.chats where id = c) then raise exception 'group calls are not supported'; end if;
  select user_id into peer from public.chat_members where chat_id = c and user_id <> me limit 1;
  if peer is null then raise exception 'user not found'; end if;
  if public.is_blocked_between(me, peer) then raise exception 'blocked'; end if;
  if not public.visible_to(public.setting_of(peer, 'who_can_call'), peer, me) then
    raise exception 'privacy: user does not accept calls';
  end if;

  perform public.expire_ringing_calls();

  -- Busy: the callee (or caller) is already in a ringing or active call.
  if exists (
    select 1 from public.calls
    where status in ('ringing', 'active') and (caller_id in (peer, me) or callee_id in (peer, me))
  ) then
    insert into public.calls (chat_id, caller_id, callee_id, video, status, ended_at)
    values (c, me, peer, with_video, 'busy', now()) returning * into row;
    return row;
  end if;

  insert into public.calls (chat_id, caller_id, callee_id, video, key_for_callee)
  values (c, me, peer, with_video, encrypted_key) returning * into row;
  insert into public.call_participants (call_id, user_id, role) values (row.id, me, 'caller'), (row.id, peer, 'callee');
  return row;
end $$;

create function public.answer_call(call uuid) returns public.calls
language plpgsql security definer set search_path = public as $$
declare row public.calls;
begin
  perform public.expire_ringing_calls();
  update public.calls set status = 'active', answered_at = now()
  where id = call and callee_id = auth.uid() and status = 'ringing'
  returning * into row;
  if row.id is null then raise exception 'call is no longer ringing'; end if;
  return row;
end $$;

create function public.decline_call(call uuid) returns void
language sql security definer set search_path = public as $$
  update public.calls set status = 'declined', ended_at = now(), ended_by = auth.uid()
  where id = call and callee_id = auth.uid() and status = 'ringing';
$$;

-- Caller hanging up before an answer → cancelled (or missed on timeout); either side after answer → ended.
create function public.end_call(call uuid, timed_out boolean default false) returns void
language sql security definer set search_path = public as $$
  update public.calls set
    status = case when status = 'active' then 'ended' when timed_out then 'missed' else 'cancelled' end,
    ended_at = now(),
    ended_by = auth.uid()
  where id = call and auth.uid() in (caller_id, callee_id) and status in ('ringing', 'active');
$$;

create function public.mark_call_presence(call uuid, joined boolean) returns void
language sql security definer set search_path = public as $$
  update public.call_participants
  set joined_at = case when joined then coalesce(joined_at, now()) else joined_at end,
      left_at = case when joined then null else now() end
  where call_id = call and user_id = auth.uid();
$$;

-- Call history with the other person's public profile.
create function public.my_calls(lim int default 100)
returns table (
  id uuid, chat_id uuid, video boolean, status text, outgoing boolean,
  created_at timestamptz, answered_at timestamptz, ended_at timestamptz,
  peer_id uuid, peer_username text, peer_display_name text
)
language sql stable security definer set search_path = public as $$
  select c.id, c.chat_id, c.video, c.status, c.caller_id = auth.uid(), c.created_at, c.answered_at, c.ended_at,
         p.id, p.username, p.display_name
  from public.calls c
  join public.profiles p on p.id = case when c.caller_id = auth.uid() then c.callee_id else c.caller_id end
  where auth.uid() in (c.caller_id, c.callee_id)
  order by c.created_at desc
  limit least(greatest(lim, 1), 500);
$$;

revoke execute on function public.expire_ringing_calls() from public, anon, authenticated;
revoke execute on function public.start_call(uuid, boolean, text), public.answer_call(uuid), public.decline_call(uuid),
  public.end_call(uuid, boolean), public.mark_call_presence(uuid, boolean), public.my_calls(int) from public, anon;
grant execute on function public.start_call(uuid, boolean, text), public.answer_call(uuid), public.decline_call(uuid),
  public.end_call(uuid, boolean), public.mark_call_presence(uuid, boolean), public.my_calls(int) to authenticated;

alter publication supabase_realtime add table public.calls;
