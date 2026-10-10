begin;

-- Keep identities private: the president reads a checked RPC, not a public view.
create function public.participation_registration_list()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.users where id = auth.uid()
    and role = 'SCHOOL_PRESIDENT' and is_active) then
    raise exception 'FORBIDDEN';
  end if;
  return jsonb_build_object(
    'registrations', coalesce((
      select jsonb_agg(to_jsonb(item) order by item.registered_at desc, item.user_id)
      from (
        select r.user_id, r.registered_at, u.mssv, u.full_name, u.email, u.phone,
          u.class_name, u.faculty_id, f.name as faculty_name, m.name as major_name
        from public.participation_registrations r
        join public.users u on u.id = r.user_id
        left join public.faculties f on f.id = u.faculty_id
        left join public.majors m on m.id = u.major_id
      ) item
    ), '[]'::jsonb),
    'faculties', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'name', name) order by name)
      from public.faculties), '[]'::jsonb)
  );
end;
$$;

-- A short-lived, actor-bound token proves that the first confirmation happened.
create table public.participation_reset_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  expires_at timestamptz not null default (now() + interval '5 minutes'),
  consumed_at timestamptz,
  deleted_count bigint
);
alter table public.participation_reset_requests enable row level security;
revoke all on public.participation_reset_requests from anon, authenticated;
create index participation_reset_actor_idx on public.participation_reset_requests(user_id);

create function public.prepare_participation_reset(p_confirmation text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare request_id uuid;
begin
  perform 1 from public.users where id = auth.uid()
    and role = 'SCHOOL_PRESIDENT' and is_active for update;
  if not found then raise exception 'FORBIDDEN'; end if;
  if p_confirmation is distinct from 'xacnhanresetdanhsachdangki' then
    raise exception 'PARTICIPATION_CONFIRMATION_REQUIRED';
  end if;
  -- Preparing another reset invalidates any older confirmation by this actor.
  delete from public.participation_reset_requests where user_id = auth.uid();
  insert into public.participation_reset_requests(user_id) values (auth.uid()) returning id into request_id;
  return request_id;
end;
$$;

create function public.reset_participation_registrations(p_request_id uuid)
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
  delete from public.participation_registrations;
  get diagnostics removed = row_count;
  update public.participation_reset_requests set consumed_at = now(), deleted_count = removed where id = request_row.id;
  insert into public.system_audit_logs(user_id, actor_snapshot, action, resource_type, resource_id, metadata)
    values (actor.id, jsonb_build_object('role', actor.role, 'full_name', actor.full_name),
      'PARTICIPATION_RESET', 'participation_registrations', request_row.id,
      jsonb_build_object('deleted_count', removed));
  return removed;
end;
$$;

revoke all on function public.participation_registration_list(), public.prepare_participation_reset(text),
  public.reset_participation_registrations(uuid) from public, anon, authenticated;
grant execute on function public.participation_registration_list(), public.prepare_participation_reset(text),
  public.reset_participation_registrations(uuid) to authenticated;

commit;
