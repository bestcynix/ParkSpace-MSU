-- Run this file once in the Supabase SQL Editor as an owner/service-role
-- operator after the two Auth accounts have been created. It is idempotent,
-- does not create passwords, and never exposes credentials to the app.

do $$
declare
  admin_id uuid;
  developer_id uuid;
begin
  select id into admin_id
  from auth.users
  where lower(email) = lower('69010518004@msu.ac.th')
  limit 1;

  if admin_id is null then
    raise notice 'Admin account 69010518004@msu.ac.th does not exist yet; create/verify it in Supabase Auth first.';
  else
    insert into public.profiles (id, email, full_name, user_type, university_id, faculty, major, preferred_locale)
    values (admin_id, '69010518004@msu.ac.th', 'นายณัฐพล พันธ์ก้อน', 'admin', '69010518004', 'คณะศึกษาศาสตร์', 'วิทยาศาสตร์การกีฬา', 'th')
    on conflict (id) do update set
      email = excluded.email,
      full_name = excluded.full_name,
      user_type = excluded.user_type,
      university_id = excluded.university_id,
      faculty = excluded.faculty,
      major = excluded.major,
      updated_at = now();

    insert into public.user_roles (user_id, role)
    values (admin_id, 'admin')
    on conflict (user_id, role) do nothing;
  end if;

  select id into developer_id
  from auth.users
  where lower(email) = lower('68011211206@msu.a.th')
  limit 1;

  if developer_id is null then
    raise notice 'Developer account 68011211206@msu.a.th does not exist yet; create/verify it in Supabase Auth first.';
  else
    insert into public.profiles (id, email, user_type, university_id, preferred_locale)
    values (developer_id, '68011211206@msu.a.th', 'developer', '68011211206', 'th')
    on conflict (id) do update set
      email = excluded.email,
      user_type = excluded.user_type,
      university_id = excluded.university_id,
      updated_at = now();

    insert into public.user_roles (user_id, role)
    values (developer_id, 'developer')
    on conflict (user_id, role) do nothing;
  end if;
end $$;

-- Verify assignment without returning passwords or private Auth metadata.
select p.full_name, p.university_id, p.user_type, u.email, ur.role
from public.profiles p
join auth.users u on u.id = p.id
left join public.user_roles ur on ur.user_id = p.id
where lower(u.email) in (lower('69010518004@msu.ac.th'), lower('68011211206@msu.a.th'))
order by u.email, ur.role;
