create extension if not exists pgcrypto;
create extension if not exists btree_gist;

do $$ begin
  create type public.app_role as enum ('guest', 'student', 'personnel', 'visitor', 'staff', 'admin', 'developer');
exception when duplicate_object then null;
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  user_type public.app_role,
  university_id text,
  faculty text,
  major text,
  department text,
  phone text,
  avatar_path text,
  preferred_locale text not null default 'th' check (preferred_locale in ('th', 'en')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles add column if not exists email text;

create table if not exists public.user_roles (
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.app_role not null,
  granted_by uuid references public.profiles(id),
  granted_at timestamptz not null default now(),
  primary key (user_id, role)
);

create table if not exists public.parking_areas (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^P[0-9]{2}$'),
  name_th text not null,
  name_en text not null,
  description_th text,
  description_en text,
  cover_image_path text,
  entrance_image_path text,
  latitude numeric(10, 7),
  longitude numeric(10, 7),
  nearby_buildings jsonb not null default '[]'::jsonb,
  capacity integer check (capacity is null or capacity >= 0),
  capacity_source text not null default 'UNVERIFIED' check (capacity_source in ('UNVERIFIED', 'MOCKUP', 'VERIFIED_SURVEY')),
  capacity_verified boolean not null default false,
  slot_mode text not null default 'AREA_ONLY' check (slot_mode in ('AREA_ONLY', 'INDIVIDUAL_SLOT')),
  slot_layout_source text not null default 'UNVERIFIED' check (slot_layout_source in ('UNVERIFIED', 'MOCKUP', 'VERIFIED_SURVEY')),
  slot_layout_verified boolean not null default false,
  vehicle_types jsonb not null default '[]'::jsonb,
  allowed_roles jsonb not null default '[]'::jsonb,
  operating_hours jsonb,
  current_status text not null default 'AVAILABLE' check (current_status in ('AVAILABLE', 'RESERVED', 'OCCUPIED', 'FULL', 'CLOSED')),
  data_status text not null default 'AWAITING_VERIFICATION' check (data_status in ('DRAFT', 'AWAITING_VERIFICATION', 'VERIFIED', 'OUTDATED')),
  verified_by uuid references public.profiles(id),
  verified_at timestamptz,
  source_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.parking_images (
  id uuid primary key default gen_random_uuid(),
  parking_area_id uuid not null references public.parking_areas(id) on delete cascade,
  storage_path text not null,
  image_type text not null check (image_type in ('COVER', 'ENTRANCE', 'GALLERY')),
  alt_th text,
  alt_en text,
  source_reference text,
  data_status text not null default 'AWAITING_VERIFICATION',
  verified_by uuid references public.profiles(id),
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.parking_slots (
  id uuid primary key default gen_random_uuid(),
  parking_area_id uuid not null references public.parking_areas(id) on delete cascade,
  slot_code text not null,
  row_label text not null default 'A',
  position integer not null default 1 check (position > 0),
  slot_type text not null default 'CAR',
  status text not null default 'AVAILABLE' check (status in ('AVAILABLE', 'RESERVED', 'OCCUPIED', 'CLOSED')),
  source_reference text,
  data_status text not null default 'AWAITING_VERIFICATION' check (data_status in ('AWAITING_VERIFICATION', 'MOCKUP', 'VERIFIED', 'OUTDATED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (parking_area_id, slot_code),
  unique (parking_area_id, row_label, position)
);

create table if not exists public.staff_assignments (
  staff_user_id uuid not null references public.profiles(id) on delete cascade,
  parking_area_id uuid not null references public.parking_areas(id) on delete cascade,
  assigned_by uuid references public.profiles(id),
  assigned_at timestamptz not null default now(),
  primary key (staff_user_id, parking_area_id)
);

create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  plate text not null,
  province text,
  vehicle_type text not null default 'CAR',
  brand text,
  model text,
  color text,
  usage_type text not null default 'PERSONAL' check (usage_type in ('PERSONAL', 'ONE_DAY')),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique default ('MSUPK-BKG-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 5))),
  user_id uuid not null references public.profiles(id),
  parking_area_id uuid not null references public.parking_areas(id),
  parking_slot_id uuid references public.parking_slots(id),
  booking_date date not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  vehicle_id uuid references public.vehicles(id),
  vehicle_snapshot jsonb not null default '{}'::jsonb,
  booking_mode text not null default 'AREA_ONLY' check (booking_mode in ('AREA_ONLY', 'INDIVIDUAL_SLOT')),
  status text not null default 'PENDING' check (status in ('DRAFT', 'PENDING', 'CONFIRMED', 'RESERVED', 'CHECKED_IN', 'COMPLETED', 'CANCELLED', 'EXPIRED', 'NO_SHOW', 'OVERSTAY', 'REJECTED')),
  cancellation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  check (
    (booking_mode = 'AREA_ONLY' and parking_slot_id is null)
    or (booking_mode = 'INDIVIDUAL_SLOT' and parking_slot_id is not null)
  )
);

-- Individual slots can have only one active booking at a time window.
-- Area-only bookings intentionally remain capacity-controlled by the area policy.
alter table public.bookings drop constraint if exists no_overlapping_slot_bookings;
alter table public.bookings add constraint no_overlapping_slot_bookings
  exclude using gist (
    parking_slot_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  ) where (
    parking_slot_id is not null
    and booking_mode = 'INDIVIDUAL_SLOT'
    and status in ('PENDING', 'CONFIRMED', 'RESERVED', 'CHECKED_IN', 'OVERSTAY')
  );

create table if not exists public.booking_status_history (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  from_status text,
  to_status text not null,
  actor_id uuid references public.profiles(id),
  reason text,
  created_at timestamptz not null default now()
);

create table if not exists public.booking_events (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  event_type text not null,
  actor_type text not null,
  actor_id uuid references public.profiles(id),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.parking_sessions (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings(id),
  user_id uuid not null references public.profiles(id),
  parking_area_id uuid not null references public.parking_areas(id),
  vehicle_id uuid references public.vehicles(id),
  check_in_at timestamptz,
  check_out_at timestamptz,
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'COMPLETED', 'OVERSTAY')),
  overstay_minutes integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.qr_tokens (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id),
  token_hash text not null unique,
  reference text not null unique,
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'USED', 'EXPIRED', 'REVOKED', 'CANCELLED', 'REISSUED')),
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.qr_scan_logs (
  id uuid primary key default gen_random_uuid(),
  qr_token_id uuid references public.qr_tokens(id),
  booking_id uuid references public.bookings(id),
  staff_user_id uuid references public.profiles(id),
  parking_area_id uuid references public.parking_areas(id),
  result text not null,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.staff_activity_logs (
  id uuid primary key default gen_random_uuid(),
  staff_user_id uuid not null references public.profiles(id),
  action text not null,
  parking_area_id uuid references public.parking_areas(id),
  booking_id uuid references public.bookings(id),
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.incidents (
  id uuid primary key default gen_random_uuid(),
  reported_by uuid not null references public.profiles(id),
  parking_area_id uuid not null references public.parking_areas(id),
  parking_slot_id uuid references public.parking_slots(id),
  category text not null,
  notes text,
  status text not null default 'NEW' check (status in ('NEW', 'REVIEWING', 'IN_PROGRESS', 'RESOLVED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  notification_type text not null,
  title_th text not null,
  title_en text not null,
  body_th text,
  body_en text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.consent_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  consent_type text not null,
  policy_version text not null,
  granted boolean not null,
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.cookie_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  necessary boolean not null default true,
  analytics boolean not null default false,
  preferences boolean not null default false,
  performance boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.policy_versions (
  id uuid primary key default gen_random_uuid(),
  policy_type text not null,
  version text not null,
  content_th text,
  content_en text,
  status text not null default 'DRAFT' check (status in ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
  published_at timestamptz,
  unique (policy_type, version)
);

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id),
  parking_area_id uuid references public.parking_areas(id),
  category text not null,
  subject text not null,
  message text not null,
  severity text not null default 'MEDIUM' check (severity in ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  route text,
  metadata jsonb not null default '{}'::jsonb,
  status text not null default 'NEW' check (status in ('NEW', 'REVIEWING', 'IN_PROGRESS', 'RESOLVED')),
  response text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.evaluations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id),
  booking_id uuid references public.bookings(id),
  answers jsonb not null default '{}'::jsonb,
  overall_rating integer check (overall_rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  event_id text not null unique,
  trace_id text not null,
  actor_type text not null,
  actor_id uuid references public.profiles(id),
  action text not null,
  entity_type text,
  entity_id uuid,
  parking_area_id uuid references public.parking_areas(id),
  before_data jsonb,
  after_data jsonb,
  reason text,
  result text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.system_events (
  id uuid primary key default gen_random_uuid(),
  event_id text not null unique,
  trace_id text not null,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.error_logs (
  id uuid primary key default gen_random_uuid(),
  trace_id text,
  route text,
  severity text not null default 'ERROR',
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.parking_status_history (
  id uuid primary key default gen_random_uuid(),
  parking_area_id uuid not null references public.parking_areas(id) on delete cascade,
  previous_status text,
  next_status text not null,
  actor_type text not null,
  actor_id uuid references public.profiles(id),
  reason text,
  created_at timestamptz not null default now()
);

create table if not exists public.waitlist_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  parking_area_id uuid not null references public.parking_areas(id) on delete cascade,
  requested_start timestamptz not null,
  requested_end timestamptz not null,
  status text not null default 'WAITING' check (status in ('WAITING', 'NOTIFIED', 'FULFILLED', 'CANCELLED', 'EXPIRED')),
  created_at timestamptz not null default now()
);

create table if not exists public.booking_policies (
  id uuid primary key default gen_random_uuid(),
  policy_key text not null unique,
  value jsonb not null,
  description_th text,
  description_en text,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

create table if not exists public.incident_images (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.incidents(id) on delete cascade,
  storage_path text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.feedback_status_history (
  id uuid primary key default gen_random_uuid(),
  feedback_id uuid not null references public.feedback(id) on delete cascade,
  from_status text,
  to_status text not null,
  actor_id uuid references public.profiles(id),
  reason text,
  created_at timestamptz not null default now()
);

create table if not exists public.evaluation_answers (
  id uuid primary key default gen_random_uuid(),
  evaluation_id uuid not null references public.evaluations(id) on delete cascade,
  question_key text not null,
  rating integer check (rating between 1 and 5),
  answer_text text,
  created_at timestamptz not null default now()
);

create table if not exists public.notification_logs (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid references public.notifications(id) on delete set null,
  channel text not null check (channel in ('IN_APP', 'EMAIL', 'PUSH', 'LINE')),
  delivery_status text not null,
  provider_reference text,
  created_at timestamptz not null default now()
);

create or replace function public.has_role(required_role public.app_role)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from public.user_roles where user_id = auth.uid() and role = required_role);
$$;

create or replace function public.is_assigned_to_area(area_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from public.staff_assignments where staff_user_id = auth.uid() and parking_area_id = area_id);
$$;

-- Public-safe availability read: returns slot labels and availability only,
-- never booking owner, vehicle, or other private record data.
create or replace function public.get_available_parking_slots(
  p_area_code text,
  p_starts_at timestamptz,
  p_ends_at timestamptz
)
returns table (
  id uuid,
  slot_code text,
  row_label text,
  position integer,
  slot_type text,
  operational_status text,
  availability text
)
language sql
security definer
set search_path = public
stable
as $$
  select
    s.id,
    s.slot_code,
    s.row_label,
    s.position,
    s.slot_type,
    s.status as operational_status,
    case
      when s.status = 'CLOSED' then 'CLOSED'
      when s.status = 'OCCUPIED' then 'OCCUPIED'
      when s.status = 'RESERVED' then 'RESERVED'
      when exists (
        select 1
        from public.bookings b
        where b.parking_slot_id = s.id
          and b.status in ('PENDING', 'CONFIRMED', 'RESERVED', 'CHECKED_IN', 'OVERSTAY')
          and tstzrange(b.starts_at, b.ends_at, '[)') && tstzrange(p_starts_at, p_ends_at, '[)')
      ) then 'RESERVED'
      else 'AVAILABLE'
    end as availability
  from public.parking_slots s
  join public.parking_areas a on a.id = s.parking_area_id
  where upper(a.code) = upper(p_area_code)
    and a.slot_mode = 'INDIVIDUAL_SLOT'
    and a.data_status in ('AWAITING_VERIFICATION', 'VERIFIED')
    and s.data_status in ('MOCKUP', 'VERIFIED')
    and p_ends_at > p_starts_at
  order by s.row_label, s.position, s.slot_code;
$$;

revoke all on function public.get_available_parking_slots(text, timestamptz, timestamptz) from public;
grant execute on function public.get_available_parking_slots(text, timestamptz, timestamptz) to anon, authenticated;

-- Issue a short-lived QR payload without exposing a database id or storing the
-- raw token. The payload is returned once to the booking owner/staff/admin.
create or replace function public.issue_booking_qr(p_booking_id uuid)
returns table (
  qr_reference text,
  qr_payload text,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  booking_row record;
  raw_token text;
  next_reference text;
  next_expiry timestamptz;
begin
  select b.id, b.reference, b.user_id, b.status, b.starts_at, b.ends_at
  into booking_row
  from public.bookings b
  where b.id = p_booking_id
    and (b.user_id = auth.uid() or public.has_role('admin') or public.has_role('staff'));

  if not found then
    raise exception 'BOOKING_NOT_FOUND_OR_FORBIDDEN';
  end if;

  if booking_row.status not in ('PENDING', 'CONFIRMED', 'RESERVED', 'CHECKED_IN', 'OVERSTAY') then
    raise exception 'BOOKING_NOT_ACTIVE';
  end if;

  update public.qr_tokens
  set status = 'REISSUED'
  where booking_id = p_booking_id and status = 'ACTIVE';

  raw_token := encode(gen_random_bytes(24), 'hex');
  next_reference := 'MSUPK-QR-' || upper(substr(encode(gen_random_bytes(5), 'hex'), 1, 10));
  next_expiry := booking_row.ends_at;

  insert into public.qr_tokens (booking_id, token_hash, reference, expires_at)
  values (p_booking_id, encode(digest(raw_token, 'sha256'), 'hex'), next_reference, next_expiry);

  return query
  select next_reference,
    json_build_object('version', 1, 'reference', next_reference, 'token', raw_token)::text,
    next_expiry;
end;
$$;

revoke all on function public.issue_booking_qr(uuid) from public;
grant execute on function public.issue_booking_qr(uuid) to authenticated;

-- Validate a QR at the gate and return only the operational fields a staff
-- member needs. Every attempt is recorded, including invalid/replayed scans.
create or replace function public.validate_booking_qr(
  p_reference text,
  p_token text,
  p_area_code text default null
)
returns table (
  booking_id uuid,
  booking_reference text,
  parking_area_code text,
  parking_area_name_th text,
  parking_slot_code text,
  vehicle_plate text,
  booking_status text,
  qr_status text,
  scan_result text,
  scan_reason text
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  qr_row record;
  result_code text := 'INVALID';
  result_reason text := 'QR_NOT_FOUND';
begin
  if not (public.has_role('staff') or public.has_role('admin')) then
    raise exception 'STAFF_OR_ADMIN_REQUIRED';
  end if;

  select q.id as qr_token_id,
    q.status as token_status,
    q.expires_at,
    b.id as booking_id,
    b.reference as booking_reference,
    b.status as booking_status,
    a.id as parking_area_id,
    a.code as parking_area_code,
    a.name_th as parking_area_name_th,
    s.slot_code as parking_slot_code,
    b.vehicle_snapshot ->> 'plate' as vehicle_plate
  into qr_row
  from public.qr_tokens q
  join public.bookings b on b.id = q.booking_id
  join public.parking_areas a on a.id = b.parking_area_id
  left join public.parking_slots s on s.id = b.parking_slot_id
  where q.reference = p_reference
    and q.token_hash = encode(digest(p_token, 'sha256'), 'hex')
  limit 1;

  if found then
    result_code := 'VALID';
    result_reason := 'OK';
    if qr_row.token_status <> 'ACTIVE' then
      result_code := 'INVALID';
      result_reason := 'QR_' || qr_row.token_status;
    elsif qr_row.expires_at <= now() then
      result_code := 'EXPIRED';
      result_reason := 'QR_EXPIRED';
      update public.qr_tokens set status = 'EXPIRED' where id = qr_row.qr_token_id and status = 'ACTIVE';
    elsif qr_row.booking_status in ('CANCELLED', 'EXPIRED', 'NO_SHOW', 'REJECTED', 'COMPLETED') then
      result_code := 'INVALID';
      result_reason := 'BOOKING_' || qr_row.booking_status;
    elsif p_area_code is not null and upper(qr_row.parking_area_code) <> upper(p_area_code) then
      result_code := 'WRONG_AREA';
      result_reason := 'QR_AREA_MISMATCH';
    end if;

    insert into public.qr_scan_logs (qr_token_id, booking_id, staff_user_id, parking_area_id, result, reason, metadata)
    values (qr_row.qr_token_id, qr_row.booking_id, auth.uid(), qr_row.parking_area_id, result_code, result_reason, jsonb_build_object('area_code', p_area_code));

    return query select qr_row.booking_id, qr_row.booking_reference, qr_row.parking_area_code,
      qr_row.parking_area_name_th, qr_row.parking_slot_code, qr_row.vehicle_plate,
      qr_row.booking_status, qr_row.token_status, result_code, result_reason;
    return;
  end if;

  insert into public.qr_scan_logs (staff_user_id, result, reason, metadata)
  values (auth.uid(), result_code, result_reason, jsonb_build_object('reference', p_reference, 'area_code', p_area_code));

  return query select null::uuid, p_reference, null::text, null::text, null::text, null::text,
    null::text, null::text, result_code, result_reason;
end;
$$;

revoke all on function public.validate_booking_qr(text, text, text) from public;
grant execute on function public.validate_booking_qr(text, text, text) to authenticated;

-- Check-in/out is a server-side state transition. Staff can act only on an
-- assigned area; Admin can act globally. The audit/event rows are written in
-- the same transaction as the booking/session update.
create or replace function public.transition_parking_session(
  p_booking_id uuid,
  p_action text,
  p_area_code text default null
)
returns table (
  booking_id uuid,
  booking_reference text,
  next_booking_status text,
  session_status text,
  transition_message text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  booking_row record;
  next_booking_status text;
  next_session_status text;
  transition_message text;
begin
  if not (public.has_role('staff') or public.has_role('admin')) then
    raise exception 'STAFF_OR_ADMIN_REQUIRED';
  end if;

  select b.id, b.reference, b.status, b.parking_area_id, a.code
  into booking_row
  from public.bookings b
  join public.parking_areas a on a.id = b.parking_area_id
  where b.id = p_booking_id
    and (public.has_role('admin') or public.is_assigned_to_area(b.parking_area_id))
    and (p_area_code is null or upper(a.code) = upper(p_area_code));

  if not found then
    raise exception 'BOOKING_NOT_FOUND_OR_AREA_FORBIDDEN';
  end if;

  if upper(p_action) = 'CHECK_IN' then
    if booking_row.status not in ('PENDING', 'CONFIRMED', 'RESERVED') then
      raise exception 'BOOKING_NOT_READY_FOR_CHECK_IN';
    end if;
    next_booking_status := 'CHECKED_IN';
    next_session_status := 'ACTIVE';
    transition_message := 'CHECK_IN_RECORDED';
    insert into public.parking_sessions (booking_id, user_id, parking_area_id, vehicle_id, check_in_at, status)
    select b.id, b.user_id, b.parking_area_id, b.vehicle_id, now(), 'ACTIVE'
    from public.bookings b
    where b.id = p_booking_id
    on conflict (booking_id) do update set check_in_at = coalesce(public.parking_sessions.check_in_at, now()), status = 'ACTIVE', updated_at = now();
  elsif upper(p_action) = 'CHECK_OUT' then
    if booking_row.status not in ('CHECKED_IN', 'OVERSTAY') then
      raise exception 'BOOKING_NOT_READY_FOR_CHECK_OUT';
    end if;
    next_booking_status := 'COMPLETED';
    next_session_status := 'COMPLETED';
    transition_message := 'CHECK_OUT_RECORDED';
    update public.parking_sessions
    set check_out_at = now(), status = 'COMPLETED', updated_at = now()
    where booking_id = p_booking_id;
    if not found then
      raise exception 'PARKING_SESSION_NOT_FOUND';
    end if;
  else
    raise exception 'UNKNOWN_SESSION_ACTION';
  end if;

  update public.bookings set status = next_booking_status, updated_at = now() where id = p_booking_id;
  insert into public.booking_events (booking_id, event_type, actor_type, actor_id, metadata)
  values (p_booking_id, upper(p_action), 'STAFF', auth.uid(), jsonb_build_object('area_code', booking_row.code));
  insert into public.staff_activity_logs (staff_user_id, action, parking_area_id, booking_id, metadata)
  values (auth.uid(), upper(p_action), booking_row.parking_area_id, p_booking_id, jsonb_build_object('area_code', booking_row.code));

  return query select booking_row.id, booking_row.reference, next_booking_status, next_session_status, transition_message;
end;
$$;

revoke all on function public.transition_parking_session(uuid, text, text) from public;
grant execute on function public.transition_parking_session(uuid, text, text) to authenticated;

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.parking_areas enable row level security;
alter table public.parking_images enable row level security;
alter table public.parking_slots enable row level security;
alter table public.staff_assignments enable row level security;
alter table public.vehicles enable row level security;
alter table public.bookings enable row level security;
alter table public.booking_status_history enable row level security;
alter table public.booking_events enable row level security;
alter table public.parking_sessions enable row level security;
alter table public.qr_tokens enable row level security;
alter table public.qr_scan_logs enable row level security;
alter table public.staff_activity_logs enable row level security;
alter table public.incidents enable row level security;
alter table public.notifications enable row level security;
alter table public.consent_records enable row level security;
alter table public.cookie_preferences enable row level security;
alter table public.policy_versions enable row level security;
alter table public.feedback enable row level security;
alter table public.evaluations enable row level security;
alter table public.audit_logs enable row level security;
alter table public.system_events enable row level security;
alter table public.error_logs enable row level security;
alter table public.parking_status_history enable row level security;
alter table public.waitlist_entries enable row level security;
alter table public.booking_policies enable row level security;
alter table public.incident_images enable row level security;
alter table public.feedback_status_history enable row level security;
alter table public.evaluation_answers enable row level security;
alter table public.notification_logs enable row level security;

create policy "public can read publishable areas" on public.parking_areas for select using (data_status in ('AWAITING_VERIFICATION', 'VERIFIED'));
create policy "public can read publishable images" on public.parking_images for select using (exists (select 1 from public.parking_areas a where a.id = parking_area_id and a.data_status in ('AWAITING_VERIFICATION', 'VERIFIED')));
create policy "users read own profile" on public.profiles for select using (id = auth.uid());
create policy "users update own profile" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy "users read own roles" on public.user_roles for select using (user_id = auth.uid());
create policy "developer inspect profiles" on public.profiles for select using (public.has_role('developer'));
create policy "developer update profiles" on public.profiles for update using (public.has_role('developer')) with check (public.has_role('developer'));
create policy "developer inspect roles" on public.user_roles for select using (public.has_role('developer'));
create policy "users manage own vehicles" on public.vehicles for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "users read own bookings" on public.bookings for select using (user_id = auth.uid() or public.has_role('admin') or public.has_role('developer'));
create policy "users create own bookings" on public.bookings for insert with check (
  user_id = auth.uid()
  and (vehicle_id is null or exists (select 1 from public.vehicles v where v.id = vehicle_id and v.user_id = auth.uid()))
  and (parking_slot_id is null or exists (select 1 from public.parking_slots s where s.id = public.bookings.parking_slot_id and s.parking_area_id = public.bookings.parking_area_id and s.data_status in ('MOCKUP', 'VERIFIED') and s.status <> 'CLOSED'))
);
create policy "users update own pending bookings" on public.bookings for update using (user_id = auth.uid() and status in ('DRAFT', 'PENDING')) with check (user_id = auth.uid());
create policy "staff read assigned bookings" on public.bookings for select using (public.is_assigned_to_area(parking_area_id) or public.has_role('admin') or public.has_role('developer'));
create policy "users read own sessions" on public.parking_sessions for select using (user_id = auth.uid() or public.has_role('admin') or public.has_role('developer'));
create policy "staff read assigned sessions" on public.parking_sessions for select using (public.is_assigned_to_area(parking_area_id));
create policy "users read own notifications" on public.notifications for select using (user_id = auth.uid());
create policy "users update own notifications" on public.notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "users manage own consents" on public.consent_records for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "users manage own cookie preferences" on public.cookie_preferences for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "users create feedback" on public.feedback for insert with check (user_id = auth.uid() or user_id is null);
create policy "users read own feedback" on public.feedback for select using (user_id = auth.uid() or public.has_role('admin'));
create policy "developer read feedback" on public.feedback for select using (public.has_role('developer'));
create policy "developer update feedback" on public.feedback for update using (public.has_role('developer')) with check (public.has_role('developer'));
create policy "users create evaluations" on public.evaluations for insert with check (user_id = auth.uid() or user_id is null);
create policy "users read own evaluations" on public.evaluations for select using (user_id = auth.uid() or public.has_role('admin'));
create policy "developer read evaluations" on public.evaluations for select using (public.has_role('developer'));
create policy "staff read assigned incidents" on public.incidents for select using (reported_by = auth.uid() or public.is_assigned_to_area(parking_area_id) or public.has_role('admin') or public.has_role('developer'));
create policy "staff create incidents" on public.incidents for insert with check (reported_by = auth.uid() and (public.has_role('staff') or public.has_role('admin')));
create policy "admin manage areas" on public.parking_areas for all using (public.has_role('admin')) with check (public.has_role('admin'));
create policy "developer inspect areas" on public.parking_areas for select using (public.has_role('developer'));
create policy "developer update areas" on public.parking_areas for update using (public.has_role('developer')) with check (public.has_role('developer'));
create policy "admin manage slots" on public.parking_slots for all using (public.has_role('admin')) with check (public.has_role('admin'));
create policy "developer read slots" on public.parking_slots for select using (public.has_role('developer'));
create policy "developer update slots" on public.parking_slots for update using (public.has_role('developer')) with check (public.has_role('developer'));
create policy "staff read assigned slots" on public.parking_slots for select using (public.is_assigned_to_area(parking_area_id) or public.has_role('admin'));
create policy "developer update parking images" on public.parking_images for update using (public.has_role('developer')) with check (public.has_role('developer'));
create policy "admin read audit logs" on public.audit_logs for select using (public.has_role('admin') or public.has_role('developer'));
create policy "admin read system events" on public.system_events for select using (public.has_role('admin') or public.has_role('developer'));
create policy "developer read error logs" on public.error_logs for select using (public.has_role('developer') or public.has_role('admin'));
create policy "users manage own waitlist" on public.waitlist_entries for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "admin read booking policies" on public.booking_policies for select using (auth.uid() is not null);
create policy "admin manage booking policies" on public.booking_policies for all using (public.has_role('admin') or public.has_role('developer')) with check (public.has_role('admin') or public.has_role('developer'));
create policy "staff read assigned status history" on public.parking_status_history for select using (public.is_assigned_to_area(parking_area_id) or public.has_role('admin') or public.has_role('developer'));
create policy "users read own evaluation answers" on public.evaluation_answers for select using (exists (select 1 from public.evaluations e where e.id = evaluation_id and (e.user_id = auth.uid() or public.has_role('admin'))));
create policy "users create evaluation answers" on public.evaluation_answers for insert with check (exists (select 1 from public.evaluations e where e.id = evaluation_id and e.user_id = auth.uid()));
create policy "developer read evaluation answers" on public.evaluation_answers for select using (public.has_role('developer'));

-- Public forms can submit an anonymous record, while RLS keeps review data private.
grant insert on public.feedback to anon, authenticated;
grant insert on public.evaluations to anon, authenticated;

-- Admin is the only role with full CRUD across the operational schema.
-- Developer can inspect diagnostics and update reference/parking data, but
-- cannot grant roles, create bookings, or delete records.
do $$
declare
  table_name text;
  policy_name text;
begin
  foreach table_name in array array[
    'profiles', 'user_roles', 'parking_areas', 'parking_images', 'parking_slots',
    'staff_assignments', 'vehicles', 'bookings', 'booking_status_history',
    'booking_events', 'parking_sessions', 'qr_tokens', 'qr_scan_logs',
    'staff_activity_logs', 'incidents', 'notifications', 'consent_records',
    'cookie_preferences', 'policy_versions', 'feedback', 'evaluations',
    'audit_logs', 'system_events', 'error_logs', 'parking_status_history',
    'waitlist_entries', 'booking_policies', 'incident_images',
    'feedback_status_history', 'evaluation_answers', 'notification_logs'
  ] loop
    policy_name := 'admin full access ' || table_name;
    execute format('drop policy if exists %I on public.%I', policy_name, table_name);
    execute format(
      'create policy %I on public.%I for all using (public.has_role(''admin'')) with check (public.has_role(''admin''))',
      policy_name,
      table_name
    );
  end loop;
end $$;

create policy "developer inspect audit logs" on public.audit_logs for select using (public.has_role('developer'));
create policy "developer inspect system events" on public.system_events for select using (public.has_role('developer'));
create policy "developer inspect error logs" on public.error_logs for select using (public.has_role('developer'));
create policy "developer inspect status history" on public.parking_status_history for select using (public.has_role('developer'));

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, preferred_locale)
  values (new.id, new.email, new.raw_user_meta_data ->> 'full_name', coalesce(new.raw_user_meta_data ->> 'preferred_locale', 'th'))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();
