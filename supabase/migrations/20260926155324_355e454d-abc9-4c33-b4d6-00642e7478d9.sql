create table public.therapist_chats (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.therapist_requests(id) on delete cascade unique,
  client_id uuid not null references auth.users(id),
  therapist_id uuid not null references public.therapists(id),
  created_at timestamptz not null default now()
);

grant select on public.therapist_chats to authenticated;
grant all on public.therapist_chats to service_role;

alter table public.therapist_chats enable row level security;

create or replace function public.is_chat_participant(_chat_id uuid, _user_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.therapist_chats c
    join public.therapists t on t.id = c.therapist_id
    where c.id = _chat_id and (c.client_id = _user_id or t.user_id = _user_id)
  )
$$;

create policy "Participants read own chats" on public.therapist_chats
  for select to authenticated
  using (public.is_chat_participant(id, auth.uid()));

create policy "Admins read all chats" on public.therapist_chats
  for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));

create table public.therapist_messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.therapist_chats(id) on delete cascade,
  sender_id uuid not null references auth.users(id),
  kind text not null default 'text',
  body text not null default '',
  media_path text,
  duration_seconds integer not null default 0,
  created_at timestamptz not null default now()
);

grant select, insert on public.therapist_messages to authenticated;
grant all on public.therapist_messages to service_role;

alter table public.therapist_messages enable row level security;

create policy "Participants read messages" on public.therapist_messages
  for select to authenticated
  using (public.is_chat_participant(chat_id, auth.uid()));

create policy "Admins read messages" on public.therapist_messages
  for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));

create policy "Participants send messages" on public.therapist_messages
  for insert to authenticated
  with check (sender_id = auth.uid() and public.is_chat_participant(chat_id, auth.uid()));

create or replace function public.on_request_scheduled_create_chat()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.status = 'scheduled' and (old.status is distinct from 'scheduled') then
    insert into public.therapist_chats (request_id, client_id, therapist_id)
    values (new.id, new.user_id, new.therapist_id)
    on conflict (request_id) do nothing;
  end if;
  return new;
end;
$$;

create trigger trg_request_scheduled_chat
  after update on public.therapist_requests
  for each row execute function public.on_request_scheduled_create_chat();

create or replace function public.on_therapist_message_notify()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  _chat record;
  _therapist_user uuid;
  _sender_name text;
begin
  select c.client_id, c.therapist_id, t.user_id as therapist_user_id, t.name as therapist_name
    into _chat
    from public.therapist_chats c
    join public.therapists t on t.id = c.therapist_id
    where c.id = new.chat_id;
  _therapist_user := _chat.therapist_user_id;
  select coalesce(nullif(p.name, ''), 'Собеседник') into _sender_name
    from public.profiles p where p.id = new.sender_id;
  if new.sender_id = _chat.client_id and _therapist_user is not null then
    insert into public.notifications (user_id, kind, title, body, link)
    values (_therapist_user, 'therapist_chat', 'Новое сообщение от клиента',
            left(new.body, 120), '/therapist-desk');
  elsif new.sender_id <> _chat.client_id then
    insert into public.notifications (user_id, kind, title, body, link)
    values (_chat.client_id, 'therapist_chat', 'Сообщение от специалиста',
            coalesce(_chat.therapist_name, 'Специалист') || ': ' || left(new.body, 100), '/therapists');
  end if;
  return new;
end;
$$;

create trigger trg_therapist_message_notify
  after insert on public.therapist_messages
  for each row execute function public.on_therapist_message_notify();

alter publication supabase_realtime add table public.therapist_messages;