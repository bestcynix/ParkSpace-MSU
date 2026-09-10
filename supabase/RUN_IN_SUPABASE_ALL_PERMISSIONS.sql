-- =============================================================================
-- ParkSpace MSU — Master SQL Fix for Permissions, Roles & Feature Flags
-- Run this entire script in Supabase Dashboard -> SQL Editor -> New Query -> Run
-- =============================================================================

begin;

-- 1. Grant Schema Usage & Privileges to All Standard Supabase Roles
grant usage on schema public to postgres, anon, authenticated, service_role;
grant all privileges on all tables in schema public to postgres, anon, authenticated, service_role;
grant all privileges on all sequences in schema public to postgres, anon, authenticated, service_role;
grant all privileges on all routines in schema public to postgres, anon, authenticated, service_role;

alter default privileges in schema public grant all on tables to postgres, anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to postgres, anon, authenticated, service_role;
alter default privileges in schema public grant all on routines to postgres, anon, authenticated, service_role;

-- 2. Storage Buckets (public read + admin/staff manage)
insert into storage.buckets (id, name, public)
values ('team-avatars', 'team-avatars', true)
on conflict (id) do update set public = true;

insert into storage.buckets (id, name, public)
values ('parking-images', 'parking-images', true)
on conflict (id) do update set public = true;

insert into storage.buckets (id, name, public)
values ('profile-avatars', 'profile-avatars', true)
on conflict (id) do update set public = true;

drop policy if exists "public read team avatars" on storage.objects;
create policy "public read team avatars" on storage.objects for select to public using (bucket_id = 'team-avatars');

drop policy if exists "public read parking images" on storage.objects;
create policy "public read parking images" on storage.objects for select to public using (bucket_id = 'parking-images');

drop policy if exists "public read profile avatars" on storage.objects;
create policy "public read profile avatars" on storage.objects for select to public using (bucket_id = 'profile-avatars');

drop policy if exists "authenticated upload profile avatars" on storage.objects;
create policy "authenticated upload profile avatars" on storage.objects for insert to authenticated with check (bucket_id = 'profile-avatars');

drop policy if exists "authenticated update profile avatars" on storage.objects;
create policy "authenticated update profile avatars" on storage.objects for update to authenticated using (bucket_id = 'profile-avatars');

drop policy if exists "authenticated delete profile avatars" on storage.objects;
create policy "authenticated delete profile avatars" on storage.objects for delete to authenticated using (bucket_id = 'profile-avatars');

-- 3. Account Deletion Requests Table
create table if not exists public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade unique,
  reason text default 'USER_REQUEST',
  status text not null default 'PENDING' check (status in ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.account_deletion_requests enable row level security;

drop policy if exists "users manage own deletion requests" on public.account_deletion_requests;
create policy "users manage own deletion requests" on public.account_deletion_requests
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "admins inspect all deletion requests" on public.account_deletion_requests;
create policy "admins inspect all deletion requests" on public.account_deletion_requests
  for all to authenticated
  using (public.has_role('admin') or exists (select 1 from public.profiles where id = auth.uid() and user_type = 'admin'));

-- 4. System Feature Flags Table (Real-time synchronization)
create table if not exists public.system_feature_flags (
  key text primary key,
  name_th text,
  name_en text,
  enabled boolean not null default false,
  category text default 'system',
  metadata jsonb default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);

alter table public.system_feature_flags enable row level security;

drop policy if exists "public read feature flags" on public.system_feature_flags;
create policy "public read feature flags" on public.system_feature_flags for select to public using (true);

drop policy if exists "admins manage feature flags" on public.system_feature_flags;
create policy "admins manage feature flags" on public.system_feature_flags
  for all to authenticated
  using (public.has_role('admin') or exists (select 1 from public.profiles where id = auth.uid() and user_type = 'admin'))
  with check (public.has_role('admin') or exists (select 1 from public.profiles where id = auth.uid() and user_type = 'admin'));

-- 5. User Roles RLS Policies (Allow Read for Authenticated, Full Manage for Admin)
alter table public.user_roles enable row level security;

drop policy if exists "read user roles" on public.user_roles;
create policy "read user roles" on public.user_roles
  for select to public
  using (true);

drop policy if exists "admins manage user roles" on public.user_roles;
create policy "admins manage user roles" on public.user_roles
  for all to authenticated
  using (public.has_role('admin') or exists (select 1 from public.profiles where id = auth.uid() and user_type = 'admin'))
  with check (public.has_role('admin') or exists (select 1 from public.profiles where id = auth.uid() and user_type = 'admin'));

-- 6. Corrected manage_user_roles Function (Admin, Staff, User)
create or replace function public.manage_user_roles(
  p_user_id uuid,
  p_roles text[]
)
returns table (role text)
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  actor_id uuid := auth.uid();
  actor_is_admin boolean := false;
  requested_roles text[];
  previous_roles text[];
  role_name text;
  trace_value text := gen_random_uuid()::text;
begin
  if actor_id is not null then
    select exists (
      select 1 from public.user_roles where user_id = actor_id and role::text in ('admin', 'developer')
      union
      select 1 from public.profiles where id = actor_id and user_type in ('admin', 'developer')
    ) into actor_is_admin;
  else
    -- Allow service_role
    actor_is_admin := true;
  end if;

  if not actor_is_admin then
    raise exception 'Admin access is required.' using errcode = '42501';
  end if;

  if not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'User profile was not found.' using errcode = 'P0002';
  end if;

  select coalesce(array_agg(item order by item), array[]::text[])
  into requested_roles
  from (
    select distinct lower(btrim(value)) as item
    from unnest(coalesce(p_roles, array[]::text[])) as requested(value)
    where btrim(value) <> ''
  ) normalized;

  if cardinality(requested_roles) = 0 then
    requested_roles := array['user']::text[];
  end if;

  delete from public.user_roles where user_id = p_user_id;

  foreach role_name in array requested_roles loop
    if role_name in ('admin', 'staff') then
      insert into public.user_roles (user_id, role, granted_by, granted_at)
      values (p_user_id, role_name::public.app_role, actor_id, now())
      on conflict (user_id, role) do update
      set granted_by = excluded.granted_by, granted_at = now();
    end if;
  end loop;

  -- Synchronize profile user_type
  update public.profiles
  set user_type = case
    when 'admin' = any(requested_roles) then 'admin'
    when 'staff' = any(requested_roles) then 'staff'
    else 'user'
  end,
  updated_at = now()
  where id = p_user_id;

  return query select unnest(requested_roles);
end;
$$;

grant execute on function public.manage_user_roles(uuid, text[]) to authenticated, anon, service_role;

-- 7. Notify PostgREST to reload schema cache
notify pgrst, 'reload schema';

commit;
