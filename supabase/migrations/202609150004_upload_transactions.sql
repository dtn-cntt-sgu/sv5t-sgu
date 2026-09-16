-- Atomic storage reservations prevent concurrent uploads from crossing the application hard limit.

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

  delete from public.upload_reservations
  where application_id = target_application_id
    and file_type = target_file_type
    and completed_at is null;

  select coalesce(file_size_bytes, 0) into previous_size
  from public.application_files
  where application_id = target_application_id and file_type = target_file_type;

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

create or replace function public.complete_upload(
  target_reservation_id uuid,
  actor_id uuid,
  actual_size_bytes bigint,
  actual_mime_type text,
  actual_etag text
)
returns public.application_files
language plpgsql
security definer
set search_path = ''
as $$
declare
  reservation public.upload_reservations%rowtype;
  result public.application_files%rowtype;
  was_resubmission boolean;
begin
  select * into reservation
  from public.upload_reservations
  where id = target_reservation_id and user_id = actor_id
  for update;

  if not found or reservation.completed_at is not null or reservation.expires_at <= now() then
    raise exception 'UPLOAD_RESERVATION_INVALID';
  end if;
  if actual_size_bytes <> reservation.expected_size_bytes
    or actual_mime_type <> reservation.mime_type then
    raise exception 'UPLOADED_OBJECT_MISMATCH';
  end if;

  select status = 'RESUBMIT_REQUIRED' into was_resubmission
  from public.applications where id = reservation.application_id;

  insert into public.application_files (
    application_id, file_type, r2_key, original_name, mime_type,
    file_size_bytes, r2_etag, review_status, feedback_note
  ) values (
    reservation.application_id, reservation.file_type, reservation.r2_key,
    reservation.original_name, reservation.mime_type, actual_size_bytes,
    actual_etag, 'PENDING', null
  )
  on conflict (application_id, file_type) do update set
    r2_key = excluded.r2_key,
    original_name = excluded.original_name,
    mime_type = excluded.mime_type,
    file_size_bytes = excluded.file_size_bytes,
    r2_etag = excluded.r2_etag,
    revision = public.application_files.revision + 1,
    review_status = 'PENDING',
    feedback_note = null,
    uploaded_at = now()
  returning * into result;

  update public.upload_reservations set completed_at = now()
  where id = target_reservation_id;

  if was_resubmission then
    update public.applications set status = 'RESUBMIT_REQUIRED'
    where id = reservation.application_id;
  end if;

  return result;
end;
$$;

revoke all on function public.reserve_upload(uuid, uuid, public.file_category, text, text, text, bigint)
  from public, anon, authenticated;
revoke all on function public.complete_upload(uuid, uuid, bigint, text, text)
  from public, anon, authenticated;
grant execute on function public.reserve_upload(uuid, uuid, public.file_category, text, text, text, bigint)
  to service_role;
grant execute on function public.complete_upload(uuid, uuid, bigint, text, text)
  to service_role;
