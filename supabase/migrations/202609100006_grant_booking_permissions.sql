begin;

-- Grant API roles full operational access to bookings, sessions, and QR codes
grant usage on schema public to anon, authenticated;

grant select, insert, update, delete on public.bookings to authenticated;
grant select, insert, update, delete on public.booking_status_history to authenticated;
grant select, insert, update, delete on public.booking_events to authenticated;
grant select, insert, update, delete on public.parking_sessions to authenticated;
grant select, insert, update, delete on public.qr_tokens to authenticated;
grant select, insert, update, delete on public.qr_scan_logs to authenticated;

-- Ensure authenticated users can execute the QR code generation RPC
grant execute on function public.issue_booking_qr(uuid) to authenticated;
grant execute on function public.validate_booking_qr(text, text, text) to authenticated;

-- Ensure RLS allows the booking creator to insert their own booking
drop policy if exists "users create own bookings" on public.bookings;
create policy "users create own bookings" on public.bookings for insert with check (
  user_id = auth.uid()
);

-- Ensure authenticated users can read their own bookings
drop policy if exists "users read own bookings" on public.bookings;
create policy "users read own bookings" on public.bookings for select using (
  user_id = auth.uid() or public.has_role('admin') or public.has_role('developer') or public.has_role('staff')
);

commit;
