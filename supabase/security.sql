-- =====================================================================
-- the Board: database rules (run once in Supabase → SQL Editor)
--
-- Safe to run more than once. It changes RULES and adds empty columns.
-- It does not delete or change any existing listing, review or account.
-- It replaces every existing policy on businesses, societies, reviews
-- and reports with the ones below.
--
-- What it does
--   * Anyone can read only LIVE listings and reviews. You also see your
--     own pending ones. Admins see everything.
--   * New posts made straight to the database (not through the
--     submit-post checker) are always forced to "pending".
--   * Owners can only change their price list, policy and pictures.
--     New pictures send the listing back to "pending" for a check.
--   * Nobody can review their own business.
--   * Only admins can read or clear reports.
--   * Adds the listing-photos storage bucket (2 MB images only; each
--     user can only upload into their own folder).
-- =====================================================================
begin;

-- ---------- 1. new columns (empty for existing rows) ----------
alter table public.businesses add column if not exists menu     jsonb;
alter table public.businesses add column if not exists policy   text;
alter table public.businesses add column if not exists photos   text[] not null default '{}';
alter table public.businesses add column if not exists avatar   text;
alter table public.businesses add column if not exists promoted boolean not null default false;
alter table public.societies  add column if not exists photos   text[] not null default '{}';

-- pictures must be in our own bucket
create or replace function public.board_photo_ok(u text) returns boolean
language sql immutable as $$
  select u is null or u like 'https://xvenwgfvgkdauxfkcgcg.supabase.co/storage/v1/object/public/listing-photos/%'
$$;
create or replace function public.board_photos_ok(a text[]) returns boolean
language sql immutable as $$
  select a is null or (cardinality(a) <= 4 and coalesce((select bool_and(public.board_photo_ok(x)) from unnest(a) x), true))
$$;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'businesses_extras_ok') then
    alter table public.businesses add constraint businesses_extras_ok check (
      (policy is null or char_length(policy) <= 300)
      and (menu is null or (jsonb_typeof(menu) = 'array' and pg_column_size(menu) <= 8000))
      and public.board_photos_ok(photos)
      and public.board_photo_ok(avatar));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'societies_photos_ok') then
    alter table public.societies add constraint societies_photos_ok check (public.board_photos_ok(photos));
  end if;
end $$;

-- ---------- 2. who is "trusted" (service role = Edge Functions, or the SQL editor) ----------
create or replace function public.board_trusted() returns boolean
language sql stable as $$
  select coalesce(auth.role(), '') = 'service_role'
      or current_user in ('postgres', 'service_role', 'supabase_admin')
$$;

-- ---------- 3. triggers ----------
-- 3a. direct inserts by a normal user are always pending, and always owned by that user
create or replace function public.board_before_insert() returns trigger
language plpgsql as $$
begin
  if not public.board_trusted() and not coalesce(public.is_admin(), false) then
    new.status := 'pending';
    if tg_table_name in ('businesses', 'societies') then
      new.owner_id := auth.uid();
      if tg_table_name = 'businesses' then new.promoted := false; end if;
    elsif tg_table_name = 'reviews' then
      new.user_id := auth.uid();
    end if;
  end if;
  return new;
end $$;

-- 3b. owners may only change price list, policy and pictures; new pictures go back for a check
create or replace function public.board_before_update() returns trigger
language plpgsql as $$
declare
  allowed text[] := array['menu', 'policy', 'photos', 'avatar', 'status', 'updated_at'];
begin
  if public.board_trusted() or coalesce(public.is_admin(), false) then
    return new;
  end if;
  if (to_jsonb(new) - allowed) is distinct from (to_jsonb(old) - allowed) then
    raise exception 'You can only change the price list, policy and pictures of a listing.' using errcode = '42501';
  end if;
  if (to_jsonb(new) -> 'photos') is distinct from (to_jsonb(old) -> 'photos')
     or (to_jsonb(new) -> 'avatar') is distinct from (to_jsonb(old) -> 'avatar') then
    new.status := 'pending';
  else
    new.status := old.status;
  end if;
  return new;
end $$;

-- 3c. no reviewing your own business
create or replace function public.board_no_self_review() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.businesses b
             where b.id = new.business_id and b.owner_id is not null and b.owner_id = new.user_id) then
    raise exception 'You can''t review your own business.' using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists board_before_insert on public.businesses;
drop trigger if exists board_before_insert on public.societies;
drop trigger if exists board_before_insert on public.reviews;
create trigger board_before_insert before insert on public.businesses for each row execute function public.board_before_insert();
create trigger board_before_insert before insert on public.societies  for each row execute function public.board_before_insert();
create trigger board_before_insert before insert on public.reviews    for each row execute function public.board_before_insert();

drop trigger if exists board_before_update on public.businesses;
drop trigger if exists board_before_update on public.societies;
create trigger board_before_update before update on public.businesses for each row execute function public.board_before_update();
create trigger board_before_update before update on public.societies  for each row execute function public.board_before_update();

drop trigger if exists board_no_self_review on public.reviews;
create trigger board_no_self_review before insert or update on public.reviews for each row execute function public.board_no_self_review();

-- ---------- 4. row level security: drop the old policies, add these ----------
alter table public.businesses enable row level security;
alter table public.societies  enable row level security;
alter table public.reviews    enable row level security;
alter table public.reports    enable row level security;

do $$ declare p record; begin
  for p in select policyname, tablename from pg_policies
           where schemaname = 'public' and tablename in ('businesses', 'societies', 'reviews', 'reports') loop
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;

-- listings
create policy "read live, own or admin" on public.businesses for select
  using (status = 'live' or owner_id = auth.uid() or public.is_admin());
create policy "post as yourself" on public.businesses for insert to authenticated
  with check (owner_id = auth.uid());
create policy "owner or admin can update" on public.businesses for update to authenticated
  using (owner_id = auth.uid() or public.is_admin()) with check (owner_id = auth.uid() or public.is_admin());
create policy "owner or admin can delete" on public.businesses for delete to authenticated
  using (owner_id = auth.uid() or public.is_admin());

create policy "read live, own or admin" on public.societies for select
  using (status = 'live' or owner_id = auth.uid() or public.is_admin());
create policy "post as yourself" on public.societies for insert to authenticated
  with check (owner_id = auth.uid());
create policy "owner or admin can update" on public.societies for update to authenticated
  using (owner_id = auth.uid() or public.is_admin()) with check (owner_id = auth.uid() or public.is_admin());
create policy "owner or admin can delete" on public.societies for delete to authenticated
  using (owner_id = auth.uid() or public.is_admin());

-- reviews (no editing; delete your own)
create policy "read live, own or admin" on public.reviews for select
  using (status = 'live' or user_id = auth.uid() or public.is_admin());
create policy "post as yourself" on public.reviews for insert to authenticated
  with check (user_id = auth.uid());
create policy "admin can update" on public.reviews for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "author or admin can delete" on public.reviews for delete to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- reports (anyone logged in can send one; only admins can read or clear them)
create policy "logged-in users can report" on public.reports for insert to authenticated
  with check (true);
create policy "admins read reports" on public.reports for select to authenticated
  using (public.is_admin());
create policy "admins clear reports" on public.reports for delete to authenticated
  using (public.is_admin());

-- one review per person per business (skipped with a notice if duplicates already exist)
do $$ begin
  create unique index if not exists reviews_one_per_user on public.reviews (business_id, user_id) where user_id is not null;
exception when others then
  raise notice 'Not adding one-review-per-person index: %', sqlerrm;
end $$;

-- ---------- 5. table rights (RLS above decides which rows) ----------
revoke insert, update, delete on public.businesses, public.societies, public.reviews, public.reports from anon;
revoke select on public.reports from anon;
grant select on public.businesses, public.societies, public.reviews to anon, authenticated;
grant insert, update, delete on public.businesses, public.societies, public.reviews to authenticated;
grant insert, select, delete on public.reports to authenticated;

-- ---------- 6. the admins list must not be readable from the website ----------
-- Only done if is_admin() runs with its owner's rights (security definer), so it keeps working.
do $$ begin
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'public' and p.proname = 'is_admin' and p.prosecdef)
     and to_regclass('public.admins') is not null then
    execute 'alter table public.admins enable row level security';
    execute 'revoke all on public.admins from anon, authenticated';
  else
    raise notice 'Check by hand: is_admin() is not security definer, so the admins table was left alone.';
  end if;
end $$;

-- ---------- 7. picture storage ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('listing-photos', 'listing-photos', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true,
  file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "board: upload to own folder" on storage.objects;
drop policy if exists "board: delete own pictures" on storage.objects;
create policy "board: upload to own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'listing-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "board: delete own pictures" on storage.objects for delete to authenticated
  using (bucket_id = 'listing-photos' and (storage.foldername(name))[1] = auth.uid()::text);
-- (no select policy: public pictures load by their link, but nobody can list the whole bucket)

commit;

-- =====================================================================
-- Quick checks after running
--   select count(*) from pg_policies
--    where tablename in ('businesses','societies','reviews','reports');   -- should be 15
--   Log out on the site: you should only see live listings.
--   Post a test listing with a photo: it should say "waiting for approval"
--   and show in Admin. Approve it, then remove it.
-- To make a business Sponsored:  update businesses set promoted = true where id = ...;
-- =====================================================================
