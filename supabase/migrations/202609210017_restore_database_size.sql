-- Safe to run again: restore the read-only RPC and refresh PostgREST's schema cache.
begin;
create or replace function public.database_size_bytes()
returns bigint language sql security definer set search_path = '' as $$
  select pg_catalog.pg_database_size(pg_catalog.current_database());
$$;
revoke all on function public.database_size_bytes() from public, anon, authenticated;
grant execute on function public.database_size_bytes() to service_role;
commit;
notify pgrst, 'reload schema';
