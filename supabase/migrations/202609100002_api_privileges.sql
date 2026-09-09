begin;

-- The schema and RLS policies define who may see or change each row, but
-- PostgREST also requires table privileges for the API roles. Keep these
-- grants explicit: public users can read published reference data, while
-- authenticated users receive only the table privileges needed by the app.
grant usage on schema public to anon, authenticated;

grant select on public.parking_areas, public.parking_images, public.project_team_members
  to anon, authenticated;

grant select, insert, update, delete on public.profiles,
  public.user_roles,
  public.parking_areas,
  public.parking_images,
  public.parking_rows,
  public.parking_slots,
  public.staff_assignments,
  public.vehicles,
  public.bookings,
  public.booking_status_history,
  public.booking_events,
  public.parking_sessions,
  public.qr_tokens,
  public.qr_scan_logs,
  public.staff_activity_logs,
  public.incidents,
  public.notifications,
  public.consent_records,
  public.cookie_preferences,
  public.policy_versions,
  public.feedback,
  public.evaluations,
  public.audit_logs,
  public.system_events,
  public.error_logs,
  public.parking_status_history,
  public.waitlist_entries,
  public.booking_policies,
  public.incident_images,
  public.feedback_status_history,
  public.evaluation_answers,
  public.notification_logs,
  public.project_team_members,
  public.account_deletion_requests
  to authenticated;

grant insert on public.feedback, public.evaluations to anon;

commit;
