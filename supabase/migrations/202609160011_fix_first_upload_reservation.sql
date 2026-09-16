-- Repair first uploads on databases still using the original reserve_upload function.
-- Preserve the locking and resubmission checks introduced in migration 007.
begin;

create or replace function public.reserve_upload(
  target_application_id uuid,
  actor_id uuid,
  target_file_type public.file_category,
  target_r2_key text,
  target_original_name text,
  target_mime_type text,
  target_size_bytes bigint
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  reservation_id uuid;
  previous_size bigint := 0;
  committed_bytes bigint;
  reserved_bytes bigint;
  hard_limit bigint;
begin
  perform 1 from public.applications where id = target_application_id for update;
  if not exists (
    select 1 from public.applications a
    join public.campaigns c on c.id = a.campaign_id
    where a.id = target_application_id and a.user_id = actor_id
      and a.status in ('DRAFT', 'RESUBMIT_REQUIRED')
      and c.is_active and not c.is_archived and now() between c.start_date and c.end_date
  ) then
    raise exception 'UPLOAD_NOT_ALLOWED';
  end if;

  select r2_hard_limit_bytes into hard_limit
  from public.system_settings where singleton for update;

  delete from public.upload_reservations
  where completed_at is null and expires_at <= now();

  if exists (select 1 from public.upload_reservations where application_id = target_application_id
    and file_type = target_file_type and completed_at is null) then
    raise exception 'UPLOAD_IN_PROGRESS';
  end if;
  if exists (select 1 from public.applications where id = target_application_id and status = 'RESUBMIT_REQUIRED')
    and not exists (select 1 from public.application_files where application_id = target_application_id
      and file_type = target_file_type and review_status = 'RESUBMIT_REQUIRED') then
    raise exception 'FILE_NOT_REQUESTED';
  end if;

  -- SELECT INTO without a matching row assigns NULL, even with a variable default.
  select coalesce((
    select file_size_bytes from public.application_files
    where application_id = target_application_id and file_type = target_file_type
  ), 0) into previous_size;

  committed_bytes := public.storage_committed_bytes();
  reserved_bytes := public.storage_reserved_bytes();

  if committed_bytes + reserved_bytes + greatest(target_size_bytes - previous_size, 0) > hard_limit then
    raise exception 'STORAGE_HARD_LIMIT_REACHED';
  end if;

  insert into public.upload_reservations (
    application_id, user_id, file_type, r2_key, original_name, mime_type,
    expected_size_bytes, replaced_size_bytes, expires_at
  ) values (
    target_application_id, actor_id, target_file_type, target_r2_key,
    target_original_name, target_mime_type, target_size_bytes, previous_size,
    now() + interval '6 minutes'
  ) returning id into reservation_id;

  return reservation_id;
end;
$$;

revoke all on function public.reserve_upload(uuid, uuid, public.file_category, text, text, text, bigint)
  from public, anon, authenticated;
grant execute on function public.reserve_upload(uuid, uuid, public.file_category, text, text, text, bigint)
  to service_role;

notify pgrst, 'reload schema';
commit;
