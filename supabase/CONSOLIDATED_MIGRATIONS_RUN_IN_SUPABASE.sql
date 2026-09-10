-- =============================================================================
-- ParkSpace MSU — Consolidated Database & Storage Migration
-- คัดลอกเนื้อหาทั้งหมดนี้ไปรันใน Supabase SQL Editor เพื่อสร้างสิทธิ์และ Bucket
-- =============================================================================

begin;

-- 1. สร้าง Storage Bucket สำหรับรูปสมาชิกทีม (team-avatars)
insert into storage.buckets (id, name, public)
values ('team-avatars', 'team-avatars', true)
on conflict (id) do update set public = true;

drop policy if exists "public read team avatars" on storage.objects;
create policy "public read team avatars" on storage.objects
  for select to public
  using (bucket_id = 'team-avatars');

drop policy if exists "admin manage team avatars" on storage.objects;
create policy "admin manage team avatars" on storage.objects
  for all to authenticated
  using (bucket_id = 'team-avatars' and public.has_role('admin'))
  with check (bucket_id = 'team-avatars' and public.has_role('admin'));

drop policy if exists "developer manage team avatars" on storage.objects;
create policy "developer manage team avatars" on storage.objects
  for all to authenticated
  using (bucket_id = 'team-avatars' and public.has_role('developer'))
  with check (bucket_id = 'team-avatars' and public.has_role('developer'));

-- 2. สร้าง Storage Bucket สำหรับรูปพื้นที่จอดรถ (parking-images)
insert into storage.buckets (id, name, public)
values ('parking-images', 'parking-images', true)
on conflict (id) do update set public = true;

drop policy if exists "public read parking images" on storage.objects;
create policy "public read parking images" on storage.objects
  for select to public
  using (bucket_id = 'parking-images');

drop policy if exists "admin manage parking images" on storage.objects;
create policy "admin manage parking images" on storage.objects
  for all to authenticated
  using (bucket_id = 'parking-images' and (public.has_role('admin') or public.has_role('developer')))
  with check (bucket_id = 'parking-images' and (public.has_role('admin') or public.has_role('developer')));

-- 3. สิทธิ์การจองและ QR Code สำหรับผู้ใช้งาน (ป้องกันข้อผิดพลาด 403 Forbidden)
grant usage on schema public to anon, authenticated;

grant select, insert, update, delete on public.bookings to authenticated;
grant select, insert, update, delete on public.booking_status_history to authenticated;
grant select, insert, update, delete on public.booking_events to authenticated;
grant select, insert, update, delete on public.parking_sessions to authenticated;
grant select, insert, update, delete on public.qr_tokens to authenticated;
grant select, insert, update, delete on public.qr_scan_logs to authenticated;

grant execute on function public.issue_booking_qr(uuid) to authenticated;
grant execute on function public.validate_booking_qr(text, text, text) to authenticated;

drop policy if exists "users create own bookings" on public.bookings;
create policy "users create own bookings" on public.bookings for insert with check (
  user_id = auth.uid()
);

drop policy if exists "users read own bookings" on public.bookings;
create policy "users read own bookings" on public.bookings for select using (
  user_id = auth.uid() or public.has_role('admin') or public.has_role('developer') or public.has_role('staff')
);

-- 4. ฟังก์ชัน manage_user_roles สำหรับ Admin/Developer ปรับยศผู้ใช้
create or replace function public.manage_user_roles(
  p_user_id uuid,
  p_roles text[]
)
returns table (role text)
language plpgsql
security definer
set search_path = ''
as \$\$
declare
  actor_id uuid := auth.uid();
  actor_kind text;
  requested_roles text[];
  previous_roles text[];
  role_name text;
  trace_value text := gen_random_uuid()::text;
begin
  if actor_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  select case
    when exists (
      select 1 from public.user_roles
      where user_id = actor_id and role::text = 'admin'
    ) then 'ADMIN'
    when exists (
      select 1 from public.user_roles
      where user_id = actor_id and role::text = 'developer'
    ) then 'DEVELOPER'
    else null
  end
  into actor_kind;

  if actor_kind is null then
    raise exception 'Admin or Developer access is required.' using errcode = '42501';
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
    raise exception 'Every account must retain at least the User role.' using errcode = '22023';
  end if;

  if exists (
    select 1 from unnest(requested_roles) item
    where item not in ('admin', 'developer', 'staff', 'user')
  ) then
    raise exception 'Unsupported role. Use Admin, Developer, Staff, or User.' using errcode = '22023';
  end if;

  if 'user' = any(requested_roles) and cardinality(requested_roles) > 1 then
    raise exception 'User is the baseline role and cannot be combined with elevated roles.' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('parkspace.manage-user-roles', 0));

  select case
    when count(*) = 0 then array['user']::text[]
    else array_agg(role::text order by role::text)
  end
  into previous_roles
  from public.user_roles
  where user_id = p_user_id
    and role::text in ('admin', 'developer', 'staff');

  if 'admin' = any(previous_roles)
    and not ('admin' = any(requested_roles))
    and not exists (
      select 1
      from public.user_roles
      where user_id <> p_user_id and role::text = 'admin'
    ) then
    raise exception 'At least one Admin account must remain.' using errcode = '23514';
  end if;

  delete from public.user_roles where user_id = p_user_id;

  foreach role_name in array requested_roles loop
    if role_name <> 'user' then
      execute
        'insert into public.user_roles (user_id, role, granted_by)
         values (, ::public.app_role, )
         on conflict (user_id, role) do update
         set granted_by = excluded.granted_by, granted_at = now()'
      using p_user_id, role_name, actor_id;
    end if;
  end loop;

  insert into public.audit_logs (
    event_id,
    trace_id,
    actor_type,
    actor_id,
    action,
    entity_type,
    entity_id,
    before_data,
    after_data,
    result,
    metadata
  ) values (
    'manage-user-roles-' || trace_value,
    trace_value,
    actor_kind,
    actor_id,
    'REPLACE_USER_ROLES',
    'profile',
    p_user_id,
    jsonb_build_object('roles', previous_roles),
    jsonb_build_object('roles', requested_roles),
    'SUCCESS',
    jsonb_build_object('source', 'user-manager')
  );

  return query select unnest(requested_roles);
end;
\$\$;

revoke all on function public.manage_user_roles(uuid, text[]) from public;
grant execute on function public.manage_user_roles(uuid, text[]) to authenticated;

commit;
