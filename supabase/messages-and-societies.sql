-- =====================================================================
-- the Board: messaging + society profiles (run in Supabase → SQL Editor)
--
-- Run supabase/security.sql FIRST. Safe to run more than once.
-- Adds new tables and columns only; it doesn't change existing rows.
--
--   * conversations + messages: only the two people in a chat can read it.
--     Chats can only be started through start_conversation() (live listing,
--     not your own). Read ticks only through mark_read().
--     At most 20 messages a minute and 20 new chats an hour per person.
--   * Live updates (new messages, read ticks) and private "typing" and
--     "in the chat" signals that only the two people can join.
--   * Societies get membership price, member perks and "Sponsored".
-- =====================================================================
begin;

do $$ begin
  if to_regprocedure('public.board_trusted()') is null then
    raise exception 'Run supabase/security.sql first, then this file.';
  end if;
end $$;

-- ---------- 1. society profiles ----------
alter table public.societies add column if not exists membership_price text;
alter table public.societies add column if not exists perks    text[]  not null default '{}';
alter table public.societies add column if not exists promoted boolean not null default false;

create or replace function public.board_perks_ok(a text[]) returns boolean
language sql immutable as $$
  select a is null or (cardinality(a) <= 8 and coalesce((select bool_and(char_length(x) <= 80) from unnest(a) x), true))
$$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'societies_profile_ok') then
    alter table public.societies add constraint societies_profile_ok check (
      (membership_price is null or char_length(membership_price) <= 40) and public.board_perks_ok(perks));
  end if;
end $$;

-- owners may also edit membership price and perks; nobody but admins can set "promoted"
create or replace function public.board_before_update() returns trigger
language plpgsql as $$
declare
  allowed text[] := array['menu', 'policy', 'photos', 'avatar', 'membership_price', 'perks', 'status', 'updated_at'];
begin
  if public.board_trusted() or coalesce(public.is_admin(), false) then
    return new;
  end if;
  if (to_jsonb(new) - allowed) is distinct from (to_jsonb(old) - allowed) then
    raise exception 'You can only change the extra details and pictures of a listing.' using errcode = '42501';
  end if;
  if (to_jsonb(new) -> 'photos') is distinct from (to_jsonb(old) -> 'photos')
     or (to_jsonb(new) -> 'avatar') is distinct from (to_jsonb(old) -> 'avatar') then
    new.status := 'pending';
  else
    new.status := old.status;
  end if;
  return new;
end $$;

create or replace function public.board_before_insert() returns trigger
language plpgsql as $$
begin
  if not public.board_trusted() and not coalesce(public.is_admin(), false) then
    new.status := 'pending';
    if tg_table_name in ('businesses', 'societies') then
      new.owner_id := auth.uid();
      new.promoted := false;
    elsif tg_table_name = 'reviews' then
      new.user_id := auth.uid();
    end if;
  end if;
  return new;
end $$;

-- ---------- 2. chats ----------
create table if not exists public.conversations (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  listing_kind  text not null check (listing_kind in ('business', 'society')),
  listing_id    text not null,
  listing_name  text not null,
  owner_id      uuid not null references auth.users (id) on delete cascade,
  customer_id   uuid not null references auth.users (id) on delete cascade,
  customer_name text not null default 'Student',
  last_at       timestamptz not null default now(),
  last_body     text,
  last_sender   uuid,
  unique (listing_kind, listing_id, customer_id),
  check (owner_id <> customer_id)
);
create index if not exists conversations_owner on public.conversations (owner_id, last_at desc);
create index if not exists conversations_customer on public.conversations (customer_id, last_at desc);

create table if not exists public.messages (
  id              bigint generated always as identity primary key,
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  body            text not null check (char_length(btrim(body)) between 1 and 1000),
  created_at      timestamptz not null default now(),
  read_at         timestamptz
);
create index if not exists messages_conv on public.messages (conversation_id, created_at);
create index if not exists messages_unread on public.messages (conversation_id) where read_at is null;

-- is the signed-in person one of the two people in this chat?
create or replace function public.board_in_chat(c uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.conversations x where x.id = c and auth.uid() in (x.owner_id, x.customer_id))
$$;

-- start (or reopen) a chat about a live listing that isn't yours
create or replace function public.start_conversation(p_kind text, p_id text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  v_owner uuid; v_name text; v_id uuid; v_me text;
begin
  if me is null then raise exception 'Log in first.' using errcode = '42501'; end if;
  if p_kind = 'business' then
    select owner_id, name into v_owner, v_name from public.businesses where id::text = p_id and status = 'live';
  elsif p_kind = 'society' then
    select owner_id, name into v_owner, v_name from public.societies where id::text = p_id and status = 'live';
  else
    raise exception 'Unknown listing type.';
  end if;
  if v_owner is null then raise exception 'That listing isn''t available to message.'; end if;
  if v_owner = me then raise exception 'This is your own listing.'; end if;

  select id into v_id from public.conversations where listing_kind = p_kind and listing_id = p_id and customer_id = me;
  if v_id is not null then return v_id; end if;

  if (select count(*) from public.conversations where customer_id = me and created_at > now() - interval '1 hour') >= 20 then
    raise exception 'You''ve started a lot of chats. Try again later.';
  end if;
  select coalesce(nullif(left(btrim(raw_user_meta_data ->> 'name'), 40), ''), 'Student') into v_me from auth.users where id = me;
  insert into public.conversations (listing_kind, listing_id, listing_name, owner_id, customer_id, customer_name)
  values (p_kind, p_id, left(v_name, 80), v_owner, me, coalesce(v_me, 'Student'))
  on conflict (listing_kind, listing_id, customer_id) do update set listing_name = excluded.listing_name
  returning id into v_id;
  return v_id;
end $$;

-- mark the other person's messages in a chat as read
create or replace function public.mark_read(p_conv uuid) returns void
language sql security definer set search_path = public as $$
  update public.messages set read_at = now()
   where conversation_id = p_conv and sender_id <> auth.uid() and read_at is null
     and public.board_in_chat(p_conv)
$$;

-- every new message: sent by you, unread, rate limited; then update the chat preview
-- (runs as the sender, so the "trusted" check sees who is really posting)
create or replace function public.board_message_before() returns trigger
language plpgsql set search_path = public as $$
begin
  if not public.board_trusted() then
    new.sender_id := auth.uid();
    new.read_at := null;
    new.created_at := now();
    new.body := btrim(new.body);
    if (select count(*) from public.messages where sender_id = new.sender_id and created_at > now() - interval '1 minute') >= 20 then
      raise exception 'Slow down: too many messages in a minute.';
    end if;
  end if;
  return new;
end $$;
create or replace function public.board_message_after() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.conversations set last_at = new.created_at, last_body = left(new.body, 120), last_sender = new.sender_id
   where id = new.conversation_id;
  return null;
end $$;
drop trigger if exists board_message_before on public.messages;
drop trigger if exists board_message_after on public.messages;
create trigger board_message_before before insert on public.messages for each row execute function public.board_message_before();
create trigger board_message_after after insert on public.messages for each row execute function public.board_message_after();

-- ---------- 3. rules ----------
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
do $$ declare p record; begin
  for p in select policyname, tablename from pg_policies
           where schemaname = 'public' and tablename in ('conversations', 'messages') loop
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;
create policy "people in the chat can see it" on public.conversations for select to authenticated
  using (auth.uid() in (owner_id, customer_id));
create policy "admins can delete a chat" on public.conversations for delete to authenticated
  using (public.is_admin());
create policy "people in the chat can read it" on public.messages for select to authenticated
  using (public.board_in_chat(conversation_id));
create policy "people in the chat can write in it" on public.messages for insert to authenticated
  with check (sender_id = auth.uid() and public.board_in_chat(conversation_id));

revoke all on public.conversations, public.messages from anon;
revoke insert, update on public.conversations from authenticated;
revoke update, delete on public.messages from authenticated;
grant select, delete on public.conversations to authenticated;
grant select, insert on public.messages to authenticated;
revoke execute on function public.start_conversation(text, text), public.mark_read(uuid) from public, anon;
grant execute on function public.start_conversation(text, text), public.mark_read(uuid) to authenticated;

-- ---------- 4. live updates ----------
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages') then
    execute 'alter publication supabase_realtime add table public.messages';
  end if;
end $$;

-- private "typing" / "in the chat" channels: only the two people can join chat:<id>
do $$ begin
  if to_regclass('realtime.messages') is not null then
    execute 'drop policy if exists "board: chat members listen" on realtime.messages';
    execute 'drop policy if exists "board: chat members send" on realtime.messages';
    execute $p$create policy "board: chat members listen" on realtime.messages for select to authenticated
      using (realtime.topic() like 'chat:%' and public.board_in_chat(nullif(substr(realtime.topic(), 6), '')::uuid))$p$;
    execute $p$create policy "board: chat members send" on realtime.messages for insert to authenticated
      with check (realtime.topic() like 'chat:%' and public.board_in_chat(nullif(substr(realtime.topic(), 6), '')::uuid))$p$;
  else
    raise notice 'realtime.messages not found: typing and "in the chat" signals will not show.';
  end if;
end $$;

commit;

-- =====================================================================
-- Quick checks after running
--   select count(*) from pg_policies where tablename in ('conversations','messages');  -- 4
--   Log in as two different accounts, message a business from one, reply from the
--   other: ticks go from one to two when the reply side opens the chat.
-- Make a society Sponsored:  update societies set promoted = true where id = ...;
-- =====================================================================
