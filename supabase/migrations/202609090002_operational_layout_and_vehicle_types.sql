begin;

-- Operational layout metadata. The A–G / 100-slot values remain MOCKUP, but
-- rows, slots, statuses, and every booking made against them are real records.
create table if not exists public.parking_rows (
  id uuid primary key default gen_random_uuid(),
  parking_area_id uuid not null references public.parking_areas(id) on delete cascade,
  row_label text not null check (row_label ~ '^[A-Z0-9_-]{1,12}$'),
  display_order integer not null default 1 check (display_order > 0),
  status text not null default 'AVAILABLE' check (status in ('AVAILABLE', 'CLOSED')),
  slot_type text not null default 'CAR',
  allowed_vehicle_types jsonb not null default '["CAR"]'::jsonb,
  data_status text not null default 'MOCKUP' check (data_status in ('MOCKUP', 'VERIFIED', 'OUTDATED')),
  source_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (parking_area_id, row_label)
);

alter table public.parking_slots add column if not exists row_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'parking_slots_row_id_fkey'
      and conrelid = 'public.parking_slots'::regclass
  ) then
    alter table public.parking_slots
      add constraint parking_slots_row_id_fkey
      foreign key (row_id) references public.parking_rows(id) on delete cascade;
  end if;
end $$;

-- Normalise the type vocabulary before constraining newly maintained records.
update public.parking_slots
set slot_type = 'OTHER'
where upper(slot_type) not in ('CAR', 'MOTORCYCLE', 'PICKUP', 'VAN', 'EV', 'OTHER', 'ANY');

update public.vehicles
set vehicle_type = 'OTHER'
where upper(vehicle_type) not in ('CAR', 'MOTORCYCLE', 'PICKUP', 'VAN', 'EV', 'OTHER');

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'parking_slots_slot_type_check'
      and conrelid = 'public.parking_slots'::regclass
  ) then
    alter table public.parking_slots
      add constraint parking_slots_slot_type_check
      check (upper(slot_type) in ('CAR', 'MOTORCYCLE', 'PICKUP', 'VAN', 'EV', 'OTHER', 'ANY'));
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'vehicles_vehicle_type_check'
      and conrelid = 'public.vehicles'::regclass
  ) then
    alter table public.vehicles
      add constraint vehicles_vehicle_type_check
      check (upper(vehicle_type) in ('CAR', 'MOTORCYCLE', 'PICKUP', 'VAN', 'EV', 'OTHER'));
  end if;
end $$;

-- All six supported vehicle categories are available to the area catalog. A
-- row/slot can narrow this list when MSU supplies a verified layout.
update public.parking_areas
set vehicle_types = '["CAR", "MOTORCYCLE", "PICKUP", "VAN", "EV", "OTHER"]'::jsonb,
    updated_at = now()
where vehicle_types = '[]'::jsonb;

-- Seed row metadata only when it does not exist. Existing Admin/Developer
-- changes are preserved by ON CONFLICT DO NOTHING.
insert into public.parking_rows (parking_area_id, row_label, display_order, status, slot_type, allowed_vehicle_types, data_status, source_reference)
select a.id, layout.row_label, layout.display_order, 'AVAILABLE', layout.slot_type, layout.allowed_vehicle_types, 'MOCKUP', 'MOCKUP_LAYOUT:' || coalesce(a.source_reference, 'MSU')
from public.parking_areas a
cross join (values
  ('A', 1, 'CAR', '["CAR"]'::jsonb),
  ('B', 2, 'CAR', '["CAR"]'::jsonb),
  ('C', 3, 'MOTORCYCLE', '["MOTORCYCLE"]'::jsonb),
  ('D', 4, 'PICKUP', '["PICKUP"]'::jsonb),
  ('E', 5, 'EV', '["EV"]'::jsonb),
  ('F', 6, 'VAN', '["VAN"]'::jsonb),
  ('G', 7, 'OTHER', '["OTHER"]'::jsonb)
) as layout(row_label, display_order, slot_type, allowed_vehicle_types)
on conflict (parking_area_id, row_label) do nothing;

update public.parking_slots s
set row_id = r.id
from public.parking_rows r
where r.parking_area_id = s.parking_area_id
  and upper(r.row_label) = upper(s.row_label)
  and s.row_id is null;

-- Existing requested demo slots are still mockup layout data. Assigning their
-- row type makes every supported vehicle category testable immediately.
update public.parking_slots s
set slot_type = r.slot_type,
    updated_at = now()
from public.parking_rows r
where r.id = s.row_id
  and s.data_status = 'MOCKUP';

alter table public.parking_rows enable row level security;

drop policy if exists "admin manage parking rows" on public.parking_rows;
create policy "admin manage parking rows" on public.parking_rows
  for all using (public.has_role('admin')) with check (public.has_role('admin'));

drop policy if exists "developer inspect parking rows" on public.parking_rows;
create policy "developer inspect parking rows" on public.parking_rows
  for select using (public.has_role('developer'));

drop policy if exists "developer insert parking rows" on public.parking_rows;
create policy "developer insert parking rows" on public.parking_rows
  for insert with check (public.has_role('developer'));

drop policy if exists "developer update parking rows" on public.parking_rows;
create policy "developer update parking rows" on public.parking_rows
  for update using (public.has_role('developer')) with check (public.has_role('developer'));

drop policy if exists "developer delete parking rows" on public.parking_rows;
create policy "developer delete parking rows" on public.parking_rows
  for delete using (public.has_role('developer'));

drop policy if exists "developer insert slots" on public.parking_slots;
create policy "developer insert slots" on public.parking_slots
  for insert with check (public.has_role('developer'));

drop policy if exists "developer delete slots" on public.parking_slots;
create policy "developer delete slots" on public.parking_slots
  for delete using (public.has_role('developer'));

drop policy if exists "developer insert parking images" on public.parking_images;
create policy "developer insert parking images" on public.parking_images
  for insert with check (public.has_role('developer'));

drop policy if exists "developer delete parking images" on public.parking_images;
create policy "developer delete parking images" on public.parking_images
  for delete using (public.has_role('developer'));

drop policy if exists "developer insert audit logs" on public.audit_logs;
create policy "developer insert audit logs" on public.audit_logs
  for insert with check (public.has_role('developer') and actor_id = auth.uid() and actor_type = 'DEVELOPER');

-- Availability includes the operational state of the area and row. It returns
-- only safe public fields: no owner, vehicle, booking id, or private metadata.
create or replace function public.get_available_parking_slots(
  p_area_code text,
  p_starts_at timestamptz,
  p_ends_at timestamptz
)
returns table (
  id uuid,
  slot_code text,
  row_label text,
  "position" integer,
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
    s."position",
    s.slot_type,
    case
      when a.current_status in ('CLOSED', 'FULL') then 'CLOSED'
      when coalesce(r.status, 'AVAILABLE') = 'CLOSED' then 'CLOSED'
      else s.status
    end as operational_status,
    case
      when a.current_status in ('CLOSED', 'FULL') then 'CLOSED'
      when coalesce(r.status, 'AVAILABLE') = 'CLOSED' then 'CLOSED'
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
  left join public.parking_rows r on r.id = s.row_id
  where upper(a.code) = upper(p_area_code)
    and a.slot_mode = 'INDIVIDUAL_SLOT'
    and a.data_status in ('AWAITING_VERIFICATION', 'VERIFIED')
    and s.data_status in ('MOCKUP', 'VERIFIED')
    and p_ends_at > p_starts_at
  order by coalesce(r.display_order, 9999), s.row_label, s."position", s.slot_code;
$$;

revoke all on function public.get_available_parking_slots(text, timestamptz, timestamptz) from public;
grant execute on function public.get_available_parking_slots(text, timestamptz, timestamptz) to anon, authenticated;

-- Public-safe operational summary used by the detail page and Admin/Dev
-- analytics. It reports counts by area/row/type without private identities.
create or replace function public.get_parking_capacity_by_type(
  p_area_code text default null,
  p_starts_at timestamptz default now(),
  p_ends_at timestamptz default now() + interval '1 hour'
)
returns table (
  area_code text,
  area_name_th text,
  area_name_en text,
  row_label text,
  slot_type text,
  total_slots bigint,
  available_slots bigint,
  reserved_slots bigint,
  occupied_slots bigint,
  closed_slots bigint
)
language sql
security definer
set search_path = public
stable
as $$
  with slot_states as (
    select
      a.code as area_code,
      a.name_th as area_name_th,
      a.name_en as area_name_en,
      s.row_label,
      s.slot_type,
      case
        when a.current_status in ('CLOSED', 'FULL') then 'CLOSED'
        when coalesce(r.status, 'AVAILABLE') = 'CLOSED' then 'CLOSED'
        when s.status = 'CLOSED' then 'CLOSED'
        when s.status = 'OCCUPIED' then 'OCCUPIED'
        when s.status = 'RESERVED' then 'RESERVED'
        when exists (
          select 1 from public.bookings b
          where b.parking_slot_id = s.id
            and b.status in ('PENDING', 'CONFIRMED', 'RESERVED', 'CHECKED_IN', 'OVERSTAY')
            and tstzrange(b.starts_at, b.ends_at, '[)') && tstzrange(p_starts_at, p_ends_at, '[)')
        ) then 'RESERVED'
        else 'AVAILABLE'
      end as availability
    from public.parking_slots s
    join public.parking_areas a on a.id = s.parking_area_id
    left join public.parking_rows r on r.id = s.row_id
    where (p_area_code is null or upper(a.code) = upper(p_area_code))
      and a.data_status in ('AWAITING_VERIFICATION', 'VERIFIED')
      and s.data_status in ('MOCKUP', 'VERIFIED')
      and p_ends_at > p_starts_at
  )
  select area_code, area_name_th, area_name_en, row_label, slot_type,
    count(*)::bigint,
    count(*) filter (where availability = 'AVAILABLE')::bigint,
    count(*) filter (where availability = 'RESERVED')::bigint,
    count(*) filter (where availability = 'OCCUPIED')::bigint,
    count(*) filter (where availability = 'CLOSED')::bigint
  from slot_states
  group by area_code, area_name_th, area_name_en, row_label, slot_type
  order by area_code, row_label, slot_type;
$$;

revoke all on function public.get_parking_capacity_by_type(text, timestamptz, timestamptz) from public;
grant execute on function public.get_parking_capacity_by_type(text, timestamptz, timestamptz) to anon, authenticated;

-- Server-side booking guard: RLS protects ownership, this trigger protects
-- area/row/slot availability and the selected vehicle/slot type contract.
create or replace function public.validate_booking_slot_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  slot_row record;
  requested_vehicle_type text;
begin
  if new.parking_slot_id is null then
    return new;
  end if;

  select s.slot_type, s.status as slot_status, a.current_status as area_status,
    coalesce(r.status, 'AVAILABLE') as row_status
  into slot_row
  from public.parking_slots s
  join public.parking_areas a on a.id = s.parking_area_id
  left join public.parking_rows r on r.id = s.row_id
  where s.id = new.parking_slot_id
    and s.parking_area_id = new.parking_area_id;

  if not found then
    raise exception 'PARKING_SLOT_NOT_FOUND_IN_AREA';
  end if;
  if slot_row.area_status in ('CLOSED', 'FULL') then
    raise exception 'PARKING_AREA_NOT_AVAILABLE';
  end if;
  if slot_row.row_status = 'CLOSED' then
    raise exception 'PARKING_ROW_CLOSED';
  end if;
  if slot_row.slot_status <> 'AVAILABLE' then
    raise exception 'PARKING_SLOT_NOT_AVAILABLE';
  end if;

  select upper(coalesce(v.vehicle_type, new.vehicle_snapshot ->> 'vehicle_type'))
  into requested_vehicle_type
  from public.vehicles v
  where v.id = new.vehicle_id;
  requested_vehicle_type := coalesce(requested_vehicle_type, upper(new.vehicle_snapshot ->> 'vehicle_type'));
  if requested_vehicle_type is null then
    raise exception 'VEHICLE_TYPE_REQUIRED_FOR_SLOT_BOOKING';
  end if;
  if upper(slot_row.slot_type) not in ('ANY', 'OTHER') and upper(slot_row.slot_type) <> requested_vehicle_type then
    raise exception 'VEHICLE_TYPE_NOT_ALLOWED_FOR_SLOT';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_booking_slot_request on public.bookings;
create trigger validate_booking_slot_request
  before insert or update of parking_area_id, parking_slot_id, vehicle_id, vehicle_snapshot, starts_at, ends_at
  on public.bookings
  for each row execute procedure public.validate_booking_slot_request();

drop policy if exists "users create own bookings" on public.bookings;
create policy "users create own bookings" on public.bookings
  for insert with check (
    user_id = auth.uid()
    and (vehicle_id is null or exists (select 1 from public.vehicles v where v.id = vehicle_id and v.user_id = auth.uid()))
    and (parking_slot_id is null or exists (
      select 1
      from public.parking_slots s
      join public.parking_areas a on a.id = s.parking_area_id
      left join public.parking_rows r on r.id = s.row_id
      where s.id = public.bookings.parking_slot_id
        and s.parking_area_id = public.bookings.parking_area_id
        and a.current_status not in ('CLOSED', 'FULL')
        and coalesce(r.status, 'AVAILABLE') <> 'CLOSED'
        and s.status = 'AVAILABLE'
        and s.data_status in ('MOCKUP', 'VERIFIED')
    ))
  );

commit;
