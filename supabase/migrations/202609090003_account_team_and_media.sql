begin;

-- Public project credits are editable by Admin/Developer while personal
-- account data remains protected by the profile and storage policies below.
create table if not exists public.project_team_members (
  id uuid primary key default gen_random_uuid(),
  display_order integer not null default 1 check (display_order > 0),
  name_th text not null,
  name_en text not null,
  student_id text,
  major_th text,
  major_en text,
  faculty_th text,
  faculty_en text,
  role_th text,
  role_en text,
  avatar_path text,
  visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists project_team_members_student_id_key
  on public.project_team_members (student_id)
  where student_id is not null;

alter table public.project_team_members enable row level security;

drop policy if exists "public read visible project team" on public.project_team_members;
create policy "public read visible project team" on public.project_team_members
  for select using (visible = true);

drop policy if exists "admin manage project team" on public.project_team_members;
create policy "admin manage project team" on public.project_team_members
  for all using (public.has_role('admin')) with check (public.has_role('admin'));

drop policy if exists "developer manage project team" on public.project_team_members;
create policy "developer manage project team" on public.project_team_members
  for all using (public.has_role('developer')) with check (public.has_role('developer'));

insert into public.project_team_members (
  display_order, name_th, name_en, student_id, major_th, major_en,
  faculty_th, faculty_en, role_th, role_en, visible
)
select 1, 'นายณัฐพล พันธ์ก้อน', 'Natthaphon Phankon', '69010518004',
  'วิทยาศาสตร์การกีฬา', 'Sports Science', 'คณะศึกษาศาสตร์',
  'Faculty of Education', 'สมาชิกทีม', 'Team member', true
where not exists (
  select 1 from public.project_team_members where student_id = '69010518004'
);

-- Profile avatars are private. The client stores only a path and requests a
-- short-lived signed URL for the authenticated owner.
insert into storage.buckets (id, name, public)
values ('profile-avatars', 'profile-avatars', false)
on conflict (id) do update set public = false;

drop policy if exists "users read own profile avatars" on storage.objects;
create policy "users read own profile avatars" on storage.objects
  for select to authenticated
  using (bucket_id = 'profile-avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "users upload own profile avatars" on storage.objects;
create policy "users upload own profile avatars" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'profile-avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "users update own profile avatars" on storage.objects;
create policy "users update own profile avatars" on storage.objects
  for update to authenticated
  using (bucket_id = 'profile-avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'profile-avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "users delete own profile avatars" on storage.objects;
create policy "users delete own profile avatars" on storage.objects
  for delete to authenticated
  using (bucket_id = 'profile-avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create table if not exists public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  reason text,
  status text not null default 'PENDING' check (status in ('PENDING', 'REVIEWING', 'COMPLETED', 'REJECTED')),
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id)
);

alter table public.account_deletion_requests enable row level security;

drop policy if exists "users create own deletion request" on public.account_deletion_requests;
create policy "users create own deletion request" on public.account_deletion_requests
  for insert with check (user_id = auth.uid());

drop policy if exists "users read own deletion request" on public.account_deletion_requests;
create policy "users read own deletion request" on public.account_deletion_requests
  for select using (user_id = auth.uid());

drop policy if exists "admin manage deletion requests" on public.account_deletion_requests;
create policy "admin manage deletion requests" on public.account_deletion_requests
  for all using (public.has_role('admin')) with check (public.has_role('admin'));

drop policy if exists "developer inspect deletion requests" on public.account_deletion_requests;
create policy "developer inspect deletion requests" on public.account_deletion_requests
  for select using (public.has_role('developer'));

-- A booking creates an in-app notification without granting users direct
-- insert access to the notifications table.
create or replace function public.notify_booking_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  area_code text;
begin
  select code into area_code from public.parking_areas where id = new.parking_area_id;
  insert into public.notifications (user_id, notification_type, title_th, title_en, body_th, body_en)
  values (
    new.user_id,
    'BOOKING_CREATED',
    'บันทึกการจองแล้ว',
    'Booking saved',
    'หมายเลขการจอง ' || new.reference || coalesce(' · ' || area_code, ''),
    'Booking ' || new.reference || coalesce(' · ' || area_code, '')
  );
  return new;
end;
$$;

drop trigger if exists notify_booking_created on public.bookings;
create trigger notify_booking_created
  after insert on public.bookings
  for each row execute procedure public.notify_booking_created();

commit;
