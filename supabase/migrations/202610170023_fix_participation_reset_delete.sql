begin;

-- Replace the reset RPC for databases that already applied migration 202610100022.
-- Keep the explicit predicate because database safeguards reject DELETE without WHERE.
create or replace function public.reset_participation_registrations(p_request_id uuid)
returns bigint language plpgsql security definer set search_path = '' as $$
declare actor public.users%rowtype; request_row public.participation_reset_requests%rowtype; removed bigint;
begin
  select * into actor from public.users where id = auth.uid()
    and role = 'SCHOOL_PRESIDENT' and is_active for update;
  if not found then raise exception 'FORBIDDEN'; end if;
  select * into request_row from public.participation_reset_requests
    where id = p_request_id and user_id = actor.id for update;
  if not found then raise exception 'PARTICIPATION_RESET_INVALID'; end if;
  -- A network retry must never remove registrations made after the first reset.
  if request_row.consumed_at is not null then return request_row.deleted_count; end if;
  if request_row.expires_at <= now() then raise exception 'PARTICIPATION_RESET_INVALID'; end if;

  -- Serialize resets with registrations; DELETE preserves the existing total trigger.
  lock table public.participation_registrations in share row exclusive mode;
  -- user_id is the NOT NULL primary key, so this deletes all current registrations.
  delete from public.participation_registrations where user_id is not null;
  get diagnostics removed = row_count;
  update public.participation_reset_requests
    set consumed_at = now(), deleted_count = removed
    where id = request_row.id;
  insert into public.system_audit_logs(user_id, actor_snapshot, action, resource_type, resource_id, metadata)
    values (actor.id, jsonb_build_object('role', actor.role, 'full_name', actor.full_name),
      'PARTICIPATION_RESET', 'participation_registrations', request_row.id,
      jsonb_build_object('deleted_count', removed));
  return removed;
end;
$$;

commit;
