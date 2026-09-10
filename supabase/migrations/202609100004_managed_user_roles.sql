begin;

-- Keep the public role vocabulary stable without rewriting the existing
-- app_role enum. "user" is the baseline access level: it is represented by
-- having no elevated role row. Profile user_type remains available for the
-- separate student/personnel/visitor classification.
create or replace function public.manage_user_roles(
  p_user_id uuid,
  p_roles text[]
)
returns table (role text)
language plpgsql
security definer
set search_path = ''
as $$
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

  -- Serialize role mutations so two concurrent requests cannot both remove
  -- what they each observed as the final Admin account.
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

  -- Legacy access-role rows are replaced here, while profiles.user_type keeps
  -- the user's university classification intact.
  delete from public.user_roles where user_id = p_user_id;

  foreach role_name in array requested_roles loop
    if role_name <> 'user' then
      execute
        'insert into public.user_roles (user_id, role, granted_by)
         values ($1, $2::public.app_role, $3)
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
$$;

revoke all on function public.manage_user_roles(uuid, text[]) from public;
grant execute on function public.manage_user_roles(uuid, text[]) to authenticated;

commit;
