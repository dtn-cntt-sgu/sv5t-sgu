-- Keep login and profile email atomic; do not update existing addresses.
begin;
create or replace function public.sync_auth_user_email()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.email is distinct from old.email then
    if new.email is null or btrim(new.email) = '' then raise exception 'INVALID_EMAIL'; end if;
    update public.users set email = lower(new.email) where id = new.id;
    if not found then raise exception 'USER_PROFILE_NOT_FOUND'; end if;
  end if;
  return new;
end;
$$;
revoke all on function public.sync_auth_user_email() from public, anon, authenticated;
drop trigger if exists on_auth_user_email_changed on auth.users;
create trigger on_auth_user_email_changed after update of email on auth.users
for each row execute function public.sync_auth_user_email();
create or replace function public.admin_email_sync_ready()
returns boolean language sql security definer set search_path='' as $$
  select exists(select 1 from pg_catalog.pg_trigger
    where tgrelid = 'auth.users'::regclass and tgname = 'on_auth_user_email_changed'
      and tgenabled in ('O','A') and tgfoid = 'public.sync_auth_user_email()'::regprocedure);
$$;
revoke all on function public.admin_email_sync_ready() from public, anon, authenticated;
grant execute on function public.admin_email_sync_ready() to service_role;
commit;
notify pgrst, 'reload schema';
