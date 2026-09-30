begin;

-- One registration per student, independent of review campaigns/applications.
create table public.participation_registrations (
  user_id uuid primary key references public.users(id) on delete cascade,
  registered_at timestamptz not null default now()
);

-- Only this aggregate is published to Realtime, never student identities.
create table public.participation_totals (
  id boolean primary key default true check (id),
  total bigint not null default 0 check (total >= 0)
);
insert into public.participation_totals (id, total) values (true, 0);

alter table public.participation_registrations enable row level security;
alter table public.participation_totals enable row level security;
revoke all on public.participation_registrations, public.participation_totals from anon, authenticated;
grant select on public.participation_registrations to authenticated;
grant select on public.participation_totals to anon, authenticated;
create policy participation_read_self on public.participation_registrations
  for select to authenticated using (user_id = auth.uid());
create policy participation_total_public_read on public.participation_totals
  for select to anon, authenticated using (true);

create function public.update_participation_total()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.participation_totals
  set total = total + case when tg_op = 'INSERT' then 1 else -1 end
  where id = true;
  return null;
end;
$$;
revoke all on function public.update_participation_total() from public, anon, authenticated;
create trigger participation_total_change
  after insert or delete on public.participation_registrations
  for each row execute function public.update_participation_total();

create function public.participation_status()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'total', t.total,
    'registered', exists (
      select 1 from public.participation_registrations r where r.user_id = auth.uid()
    )
  ) from public.participation_totals t where t.id = true;
$$;
revoke all on function public.participation_status() from public, anon, authenticated;
grant execute on function public.participation_status() to anon, authenticated;

create function public.register_participation()
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  -- Check trusted database profile, including direct RPC callers.
  perform 1 from public.users
  where id = auth.uid() and role = 'STUDENT' and is_active
  for share;
  if not found then
    raise exception 'FORBIDDEN';
  end if;
  insert into public.participation_registrations (user_id)
  values (auth.uid()) on conflict (user_id) do nothing;
  return public.participation_status();
end;
$$;
revoke all on function public.register_participation() from public, anon, authenticated;
grant execute on function public.register_participation() to authenticated;

-- Supabase provides this publication; allow local Postgres setups as well.
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  alter publication supabase_realtime add table public.participation_totals;
end;
$$;

commit;
