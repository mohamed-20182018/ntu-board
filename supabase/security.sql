-- the Board (main branch): lock down the Supabase tables the website uses.
--
-- Run this ONCE in Supabase → SQL Editor, after reading it. It is safe to run again.
-- What it does:
--   1. Adds an "approved" column. New listings start unapproved and are hidden until you approve them.
--      Existing rows (the example listings) also become hidden until you approve them.
--   2. Limits how long each field can be.
--   3. Turns on Row Level Security: the public can READ approved listings and SUBMIT new ones, nothing else.
--      Nobody can edit or delete through the website's key.
--   4. Caps new submissions at 30 an hour across the whole site, so nobody can flood the database.
--   5. Adds a "promoted" column for the Featured / Sponsored spotlight. Only you can switch it on.
--
-- To approve a listing:   update public.businesses set approved = true where id = 123;
--                         update public.societies  set approved = true where id = 45;
-- To see what's waiting:  select * from public.businesses where not approved order by created_at desc;

begin;

-- 1. Moderation
alter table public.businesses add column if not exists approved boolean not null default false;
alter table public.societies  add column if not exists approved boolean not null default false;
-- "Featured" (the Sponsored spotlight on the home page). Only you can set it, in the Table Editor or with SQL:
--   update public.businesses set promoted = true where id = 123;
alter table public.businesses add column if not exists promoted boolean not null default false;

-- 2. Size limits (NOT VALID: only checked for new and edited rows)
do $$ begin
  alter table public.businesses add constraint businesses_sizes check (
    char_length(coalesce(name, '')) between 1 and 80 and char_length(coalesce(what, '')) <= 40
    and char_length(coalesce(price, '')) <= 30 and char_length(coalesce(location, '')) <= 60
    and char_length(coalesce(description, '')) <= 300 and char_length(coalesce(contact, '')) between 1 and 120) not valid;
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.societies add constraint societies_sizes check (
    char_length(coalesce(name, '')) between 1 and 80 and char_length(coalesce(what, '')) <= 40
    and char_length(coalesce(meet, '')) <= 120 and char_length(coalesce(description, '')) <= 300
    and char_length(coalesce(contact, '')) between 1 and 120) not valid;
exception when duplicate_object then null; end $$;

-- 3. Row Level Security: replace whatever rules exist with exactly these
alter table public.businesses enable row level security;
alter table public.societies  enable row level security;
do $$ declare p record; begin
  for p in select policyname, tablename from pg_policies where schemaname = 'public' and tablename in ('businesses', 'societies') loop
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;
create policy "anyone can read approved listings" on public.businesses for select to anon, authenticated using (approved);
create policy "anyone can read approved societies" on public.societies  for select to anon, authenticated using (approved);
create policy "anyone can submit a listing"  on public.businesses for insert to anon, authenticated with check (approved = false);
create policy "anyone can submit a society"  on public.societies  for insert to anon, authenticated with check (approved = false);

-- Table rights: read, and insert only the form's own fields (not id, created_at or approved). No update, delete or truncate.
revoke all on public.businesses, public.societies from anon, authenticated;
grant select on public.businesses, public.societies to anon, authenticated;
grant insert (name, what, price, location, description, contact) on public.businesses to anon, authenticated;
grant insert (name, what, meet, description, contact) on public.societies to anon, authenticated;
grant usage on all sequences in schema public to anon, authenticated;

-- 4. Flood limit: at most 30 new submissions per hour across both tables
create or replace function public.board_throttle_submissions() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.businesses where created_at > now() - interval '1 hour')
   + (select count(*) from public.societies  where created_at > now() - interval '1 hour') >= 30 then
    raise exception 'Too many new listings right now. Try again in an hour.';
  end if;
  return new;
end $$;
revoke all on function public.board_throttle_submissions() from public, anon, authenticated;
drop trigger if exists board_throttle on public.businesses;
drop trigger if exists board_throttle on public.societies;
create trigger board_throttle before insert on public.businesses for each row execute function public.board_throttle_submissions();
create trigger board_throttle before insert on public.societies  for each row execute function public.board_throttle_submissions();

commit;

-- Check it worked (should show rls_on = true and only the four policies above):
-- select relname, relrowsecurity as rls_on from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r';
-- select tablename, policyname, cmd, roles from pg_policies where schemaname = 'public';
