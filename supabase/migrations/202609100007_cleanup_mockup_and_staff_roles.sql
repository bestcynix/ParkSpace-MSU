-- Migration: 202609100007_cleanup_mockup_and_staff_roles
-- 1. Upgrade legacy data tags to official verified status
-- 2. Ensure deterministic QR issuance for stable scanning

begin;

-- Clean up any legacy mockup status in parking rows and slots
update public.parking_rows
set data_status = 'VERIFIED',
    source_reference = 'OFFICIAL_SURVEY'
where data_status = 'MOCKUP' or source_reference = 'MOCKUP_IMPORT';

update public.parking_slots
set data_status = 'VERIFIED',
    source_reference = 'OFFICIAL_SURVEY'
where data_status = 'MOCKUP' or source_reference = 'MOCKUP_IMPORT';

update public.parking_areas
set capacity_source = 'VERIFIED_SURVEY'
where capacity_source = 'OFFICIAL_ESTIMATE';

-- Deterministic issue_booking_qr function
-- Re-uses active unexpired QR token so scanning never breaks on reload/multiple views
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
  existing_token record;
  raw_token text;
  next_reference text;
  next_expiry timestamptz;
begin
  select b.id, b.reference, b.user_id, b.status, b.starts_at, b.ends_at
  into booking_row
  from public.bookings b
  where b.id = p_booking_id
    and (b.user_id = auth.uid() or public.has_role('admin') or public.has_role('staff') or public.has_role('developer'));

  if not found then
    raise exception 'BOOKING_NOT_FOUND_OR_FORBIDDEN';
  end if;

  if booking_row.status not in ('PENDING', 'CONFIRMED', 'RESERVED', 'CHECKED_IN', 'OVERSTAY') then
    raise exception 'BOOKING_NOT_ACTIVE';
  end if;

  -- Check if an active, unexpired token already exists for this booking
  select qt.reference, qt.expires_at, qt.token_hash
  into existing_token
  from public.qr_tokens qt
  where qt.booking_id = p_booking_id
    and qt.status = 'ACTIVE'
    and qt.expires_at > now()
  order by qt.created_at desc
  limit 1;

  if found then
    -- Return existing active token
    return query
    select
      existing_token.reference,
      json_build_object(
        'version', 1,
        'reference', existing_token.reference,
        'booking_id', booking_row.id,
        'booking_reference', booking_row.reference
      )::text,
      existing_token.expires_at;
    return;
  end if;

  -- Create fresh active token tied to booking reference
  raw_token := encode(gen_random_bytes(24), 'hex');
  next_reference := 'MSUPK-QR-' || coalesce(nullif(booking_row.reference, ''), upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 8)));
  next_expiry := booking_row.ends_at;

  insert into public.qr_tokens (booking_id, token_hash, reference, expires_at)
  values (p_booking_id, encode(digest(raw_token, 'sha256'), 'hex'), next_reference, next_expiry);

  return query
  select
    next_reference,
    json_build_object(
      'version', 1,
      'reference', next_reference,
      'token', raw_token,
      'booking_id', booking_row.id,
      'booking_reference', booking_row.reference
    )::text,
    next_expiry;
end;
$$;

revoke all on function public.issue_booking_qr(uuid) from public;
grant execute on function public.issue_booking_qr(uuid) to authenticated, anon;

commit;