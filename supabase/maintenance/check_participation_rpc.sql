-- Run in Supabase SQL Editor if participation APIs report PGRST202.
-- This does not recreate tables/functions or modify student registrations.
select
  to_regclass('public.participation_registrations') is not null as registrations_table_exists,
  to_regclass('public.participation_reset_requests') is not null as reset_requests_table_exists,
  to_regclass('public.system_audit_logs') is not null as audit_log_table_exists,
  exists (
    select 1 from pg_trigger
    where tgrelid = to_regclass('public.participation_registrations')
      and tgname = 'participation_total_change'
      and not tgisinternal
  ) as participation_total_trigger_exists;

with expected(signature, argument_names) as (
  values
    ('public.participation_registration_list()', array[]::text[]),
    ('public.prepare_participation_reset(text)', array['p_confirmation']),
    ('public.reset_participation_registrations(uuid)', array['p_request_id'])
)
select e.signature,
  p.oid is not null as function_exists,
  p.oid is not null and coalesce(p.proargnames, array[]::text[]) = e.argument_names as arguments_match,
  p.prosecdef as security_definer,
  case when p.oid is not null then has_function_privilege('authenticated', p.oid, 'EXECUTE') end as authenticated_can_execute,
  case when p.oid is not null then has_function_privilege('anon', p.oid, 'EXECUTE') end as anon_can_execute
from expected e
left join pg_proc p on p.oid = to_regprocedure(e.signature);
  
-- PostgREST rebuilds its schema cache when this notification is received.
-- If a function/table is missing, apply migration 202610100022 first.
notify pgrst, 'reload schema';
