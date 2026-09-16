-- Trusted database functions and state-machine triggers.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger users_set_updated_at before update on public.users
for each row execute function public.set_updated_at();
create trigger campaigns_set_updated_at before update on public.campaigns
for each row execute function public.set_updated_at();
create trigger documents_set_updated_at before update on public.public_documents
for each row execute function public.set_updated_at();
create trigger applications_set_updated_at before update on public.applications
for each row execute function public.set_updated_at();

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_role public.user_role;
begin
  requested_role := case
    when new.raw_app_meta_data ->> 'role' in ('FACULTY_SECRETARY', 'SCHOOL_PRESIDENT', 'SUPER_ADMIN')
      then (new.raw_app_meta_data ->> 'role')::public.user_role
    else 'STUDENT'::public.user_role
  end;

  insert into public.users (
    id, mssv, full_name, email, phone, role, faculty_id, major_id, class_name
  ) values (
    new.id,
    nullif(upper(trim(new.raw_user_meta_data ->> 'mssv')), ''),
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), 'Chưa cập nhật'),
    lower(new.email),
    nullif(regexp_replace(new.raw_user_meta_data ->> 'phone', '[^0-9+]', '', 'g'), ''),
    requested_role,
    nullif(new.raw_user_meta_data ->> 'faculty_id', '')::uuid,
    nullif(new.raw_user_meta_data ->> 'major_id', '')::uuid,
    nullif(upper(trim(new.raw_user_meta_data ->> 'class_name')), '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

create or replace function public.prevent_identity_escalation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user not in ('postgres', 'service_role', 'supabase_admin') then
    new.role := old.role;
    new.is_active := old.is_active;
    new.mssv := old.mssv;
    new.email := old.email;
    new.faculty_id := old.faculty_id;
    new.major_id := old.major_id;
    new.class_name := old.class_name;
  end if;
  return new;
end;
$$;

create trigger users_prevent_identity_escalation
before update on public.users
for each row execute function public.prevent_identity_escalation();

create or replace function public.sync_application_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_application_id uuid := coalesce(new.application_id, old.application_id);
  current_application public.applications%rowtype;
  expected_count integer;
  total_count integer;
  accepted_count integer;
  rejected_count integer;
  resubmit_count integer;
begin
  select * into current_application
  from public.applications
  where id = target_application_id
  for update;

  if current_application.status = 'DRAFT' then
    return coalesce(new, old);
  end if;

  expected_count := case when current_application.type = 'INDIVIDUAL' then 3 else 2 end;

  select count(*),
         count(*) filter (where review_status = 'ACCEPTED'),
         count(*) filter (where review_status = 'REJECTED'),
         count(*) filter (where review_status = 'RESUBMIT_REQUIRED')
  into total_count, accepted_count, rejected_count, resubmit_count
  from public.application_files
  where application_id = target_application_id;

  update public.applications
  set status = case
    when rejected_count > 0 then 'REJECTED'::public.application_status
    when resubmit_count > 0 then 'RESUBMIT_REQUIRED'::public.application_status
    when total_count = expected_count and accepted_count = expected_count
      then 'APPROVED'::public.application_status
    when current_application.status = 'RESUBMITTED' then 'RESUBMITTED'::public.application_status
    else 'SUBMITTED'::public.application_status
  end,
  rejection_reason = case when rejected_count = 0 then null else rejection_reason end
  where id = target_application_id;

  return coalesce(new, old);
end;
$$;

create trigger application_file_status_changed
after update of review_status or delete on public.application_files
for each row execute function public.sync_application_status();

create or replace function public.storage_committed_bytes()
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(file_size_bytes), 0)::bigint from public.application_files;
$$;

create or replace function public.storage_reserved_bytes()
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(greatest(expected_size_bytes - replaced_size_bytes, 0)), 0)::bigint
  from public.upload_reservations
  where completed_at is null and expires_at > now();
$$;

create or replace function public.archive_campaign(target_campaign_id uuid, actor_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_campaign public.campaigns%rowtype;
begin
  select * into target_campaign from public.campaigns where id = target_campaign_id for update;
  if not found then raise exception 'CAMPAIGN_NOT_FOUND'; end if;
  if target_campaign.is_active or target_campaign.end_date >= now() then
    raise exception 'CAMPAIGN_MUST_BE_CLOSED';
  end if;
  if not exists (
    select 1 from public.campaign_exports
    where campaign_id = target_campaign_id and status = 'READY'
      and manifest_r2_key is not null and archive_r2_key is not null
  ) then
    raise exception 'READY_EXPORT_REQUIRED';
  end if;

  insert into public.campaign_statistics (
    campaign_id, faculty_id, total_submitted, total_pending,
    total_resubmit, total_approved, total_rejected
  )
  select a.campaign_id, u.faculty_id,
    count(*) filter (where a.status <> 'DRAFT'),
    count(*) filter (where a.status in ('SUBMITTED', 'RESUBMITTED')),
    count(*) filter (where a.status = 'RESUBMIT_REQUIRED'),
    count(*) filter (where a.status = 'APPROVED'),
    count(*) filter (where a.status = 'REJECTED')
  from public.applications a
  join public.users u on u.id = a.user_id
  where a.campaign_id = target_campaign_id and u.faculty_id is not null
  group by a.campaign_id, u.faculty_id
  on conflict (campaign_id, faculty_id) do update set
    total_submitted = excluded.total_submitted,
    total_pending = excluded.total_pending,
    total_resubmit = excluded.total_resubmit,
    total_approved = excluded.total_approved,
    total_rejected = excluded.total_rejected,
    archived_at = now();

  delete from public.applications where campaign_id = target_campaign_id;
  update public.campaigns set is_active = false, is_archived = true where id = target_campaign_id;

  insert into public.system_audit_logs(user_id, actor_snapshot, action, resource_type, resource_id)
  select actor_id, jsonb_build_object('email', email, 'role', role),
    'PURGE_CAMPAIGN_DATABASE', 'campaign', target_campaign_id
  from public.users where id = actor_id;
end;
$$;

revoke all on function public.archive_campaign(uuid, uuid) from public, anon, authenticated;
grant execute on function public.archive_campaign(uuid, uuid) to service_role;

