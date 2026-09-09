begin;

-- Keep the public slot list and the area summary consistent. A checked-in or
-- overstayed booking is live occupancy; pending/confirmed/reserved bookings
-- are reservations. The A–G / 100-slot layout remains mockup metadata, while
-- these states are calculated from the real slot and booking records.
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
      when s.status = 'CLOSED' then 'CLOSED'
      when a.current_status = 'OCCUPIED' then 'OCCUPIED'
      when a.current_status = 'RESERVED' then 'RESERVED'
      when s.status = 'OCCUPIED' then 'OCCUPIED'
      when s.status = 'RESERVED' then 'RESERVED'
      when exists (
        select 1
        from public.bookings b
        where b.parking_slot_id = s.id
          and b.status in ('CHECKED_IN', 'OVERSTAY')
          and tstzrange(b.starts_at, b.ends_at, '[)') && tstzrange(p_starts_at, p_ends_at, '[)')
      ) then 'OCCUPIED'
      when exists (
        select 1
        from public.bookings b
        where b.parking_slot_id = s.id
          and b.status in ('PENDING', 'CONFIRMED', 'RESERVED')
          and tstzrange(b.starts_at, b.ends_at, '[)') && tstzrange(p_starts_at, p_ends_at, '[)')
      ) then 'RESERVED'
      else 'AVAILABLE'
    end as operational_status,
    case
      when a.current_status in ('CLOSED', 'FULL') then 'CLOSED'
      when coalesce(r.status, 'AVAILABLE') = 'CLOSED' then 'CLOSED'
      when s.status = 'CLOSED' then 'CLOSED'
      when a.current_status = 'OCCUPIED' then 'OCCUPIED'
      when a.current_status = 'RESERVED' then 'RESERVED'
      when s.status = 'OCCUPIED' then 'OCCUPIED'
      when s.status = 'RESERVED' then 'RESERVED'
      when exists (
        select 1
        from public.bookings b
        where b.parking_slot_id = s.id
          and b.status in ('CHECKED_IN', 'OVERSTAY')
          and tstzrange(b.starts_at, b.ends_at, '[)') && tstzrange(p_starts_at, p_ends_at, '[)')
      ) then 'OCCUPIED'
      when exists (
        select 1
        from public.bookings b
        where b.parking_slot_id = s.id
          and b.status in ('PENDING', 'CONFIRMED', 'RESERVED')
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
        when a.current_status = 'OCCUPIED' then 'OCCUPIED'
        when a.current_status = 'RESERVED' then 'RESERVED'
        when s.status = 'OCCUPIED' then 'OCCUPIED'
        when s.status = 'RESERVED' then 'RESERVED'
        when exists (
          select 1 from public.bookings b
          where b.parking_slot_id = s.id
            and b.status in ('CHECKED_IN', 'OVERSTAY')
            and tstzrange(b.starts_at, b.ends_at, '[)') && tstzrange(p_starts_at, p_ends_at, '[)')
        ) then 'OCCUPIED'
        when exists (
          select 1 from public.bookings b
          where b.parking_slot_id = s.id
            and b.status in ('PENDING', 'CONFIRMED', 'RESERVED')
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

revoke all on function public.get_available_parking_slots(text, timestamptz, timestamptz) from public;
grant execute on function public.get_available_parking_slots(text, timestamptz, timestamptz) to anon, authenticated;
revoke all on function public.get_parking_capacity_by_type(text, timestamptz, timestamptz) from public;
grant execute on function public.get_parking_capacity_by_type(text, timestamptz, timestamptz) to anon, authenticated;

commit;
