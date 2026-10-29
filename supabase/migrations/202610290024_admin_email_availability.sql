-- Auth can contain accounts without a public profile (e.g. pending signups).
-- Admin updates may report a unique-email violation as an opaque Auth 500.
-- Check both stores without exposing Auth accounts through the public API.
begin;

create or replace function public.admin_email_available(
  target_user_id uuid,
  requested_email text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select target_user_id is not null
    and nullif(btrim(requested_email), '') is not null
    and not exists (
      select 1 from auth.users
      where lower(email) = lower(btrim(requested_email))
        and id <> target_user_id
    )
    and not exists (
      select 1 from public.users
      where lower(email) = lower(btrim(requested_email))
        and id <> target_user_id
    );
$$;

revoke all on function public.admin_email_available(uuid, text) from public, anon, authenticated;
grant execute on function public.admin_email_available(uuid, text) to service_role;

commit;
notify pgrst, 'reload schema';
