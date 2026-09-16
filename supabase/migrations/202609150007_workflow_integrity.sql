-- Workflow integrity: serialize submit/upload/review; preserve existing data.
begin;
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

  select coalesce(file_size_bytes, 0) into previous_size
  from public.application_files
  where application_id = target_application_id and file_type = target_file_type;

  previous_size := coalesce(previous_size, 0);

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
  perform 1 from public.applications where id = (
    select application_id from public.upload_reservations where id = target_reservation_id and user_id = actor_id
  ) for update;
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

  if not exists (select 1 from public.applications a join public.campaigns c on c.id = a.campaign_id
    join public.users u on u.id = a.user_id
    where a.id = reservation.application_id and a.user_id = actor_id and u.is_active
    and a.status in ('DRAFT', 'RESUBMIT_REQUIRED') and c.is_active and not c.is_archived
    and now() between c.start_date and c.end_date) then raise exception 'UPLOAD_NOT_ALLOWED'; end if;
  if exists (select 1 from public.applications where id = reservation.application_id and status = 'RESUBMIT_REQUIRED')
    and not exists (select 1 from public.application_files where application_id = reservation.application_id
    and file_type = reservation.file_type and review_status = 'RESUBMIT_REQUIRED') then
    raise exception 'FILE_NOT_REQUESTED';
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

-- Atomic faculty-scoped review workflow.

create or replace function public.review_application_file(
  target_file_id uuid,
  actor_id uuid,
  target_action public.review_action,
  target_note text
)
returns public.application_files
language plpgsql
security definer
set search_path = ''
as $$
declare
  reviewer public.users%rowtype;
  target_file public.application_files%rowtype;
  applicant_faculty_id uuid;
  next_status public.file_review_status;
begin
  select * into reviewer from public.users
  where id = actor_id and is_active for update;
  if not found or reviewer.role <> 'FACULTY_SECRETARY' then
    raise exception 'REVIEWER_NOT_ALLOWED';
  end if;

  perform 1 from public.applications where id = (
    select application_id from public.application_files where id = target_file_id
  ) for update;
  if exists (select 1 from public.applications a join public.application_files f on f.application_id = a.id
    where f.id = target_file_id and a.status = 'DRAFT') then raise exception 'REVIEW_NOT_ALLOWED'; end if;
  if exists (select 1 from public.upload_reservations r join public.application_files f on f.application_id = r.application_id
    where f.id = target_file_id and r.completed_at is null and r.expires_at > now()) then
    raise exception 'UPLOAD_IN_PROGRESS';
  end if;
  select f.* into target_file
  from public.application_files f
  where f.id = target_file_id
  for update;

  if not found then raise exception 'FILE_NOT_FOUND'; end if;

  select u.faculty_id into applicant_faculty_id
  from public.applications a
  join public.users u on u.id = a.user_id
  where a.id = target_file.application_id;

  if applicant_faculty_id is distinct from reviewer.faculty_id then
    raise exception 'CROSS_FACULTY_REVIEW_DENIED';
  end if;
  if target_action <> 'ACCEPT' and char_length(trim(coalesce(target_note, ''))) < 5 then
    raise exception 'REVIEW_NOTE_REQUIRED';
  end if;

  next_status := case target_action
    when 'ACCEPT' then 'ACCEPTED'::public.file_review_status
    when 'REJECT' then 'REJECTED'::public.file_review_status
    else 'RESUBMIT_REQUIRED'::public.file_review_status
  end;

  insert into public.file_review_logs (
    application_file_id, reviewer_id, reviewer_snapshot, action,
    previous_status, new_status, note
  ) values (
    target_file_id, actor_id,
    jsonb_build_object('full_name', reviewer.full_name, 'email', reviewer.email,
      'role', reviewer.role, 'faculty_id', reviewer.faculty_id),
    target_action, target_file.review_status, next_status, nullif(trim(target_note), '')
  );

  update public.application_files
  set review_status = next_status,
      feedback_note = case when target_action = 'ACCEPT' then null else trim(target_note) end
  where id = target_file_id
  returning * into target_file;

  return target_file;
end;
$$;

revoke all on function public.review_application_file(uuid, uuid, public.review_action, text)
  from public, anon, authenticated;
grant execute on function public.review_application_file(uuid, uuid, public.review_action, text)
  to service_role;

create or replace function public.submit_application(target_application_id uuid, actor_id uuid)
returns public.applications language plpgsql security definer set search_path = '' as $$
declare a public.applications%rowtype; expected public.file_category[];
begin
  select * into a from public.applications where id = target_application_id and user_id = actor_id for update;
  if not found then raise exception 'APPLICATION_NOT_FOUND'; end if;
  if a.status not in ('DRAFT', 'RESUBMIT_REQUIRED') then raise exception 'INVALID_APPLICATION_TRANSITION'; end if;
  if not exists (select 1 from public.users where id = actor_id and is_active and role = 'STUDENT') then raise exception 'UPLOAD_NOT_ALLOWED'; end if;
  if not exists (select 1 from public.campaigns where id = a.campaign_id and is_active and not is_archived
    and now() between start_date and end_date) then raise exception 'CAMPAIGN_NOT_OPEN'; end if;
  if exists (select 1 from public.upload_reservations where application_id = a.id and completed_at is null
    and expires_at > now()) then raise exception 'UPLOAD_IN_PROGRESS'; end if;
  expected := case when a.type = 'INDIVIDUAL'
    then array['DECLARATION_DOC','EVIDENCE_DOC','PORTRAIT_IMG']::public.file_category[]
    else array['COLLECTIVE_DOC','COLLECTIVE_IMG']::public.file_category[] end;
  if exists (select 1 from unnest(expected) t where not exists
    (select 1 from public.application_files f where f.application_id = a.id and f.file_type = t))
    or exists (select 1 from public.application_files where application_id = a.id and review_status = 'RESUBMIT_REQUIRED')
    then raise exception 'REQUIRED_FILES_MISSING'; end if;
  update public.applications set status = case when a.status = 'DRAFT' then 'SUBMITTED'::public.application_status
    else 'RESUBMITTED'::public.application_status end, submitted_at = coalesce(a.submitted_at, now())
    where id = a.id returning * into a;
  return a;
end; $$;
revoke all on function public.submit_application(uuid,uuid) from public, anon, authenticated;
grant execute on function public.submit_application(uuid,uuid) to service_role;

create or replace function public.finalize_review(target_application_id uuid, actor_id uuid, decisions jsonb)
returns public.applications language plpgsql security definer set search_path = '' as $$
declare a public.applications%rowtype; d jsonb; expected_count integer;
begin
  select * into a from public.applications where id = target_application_id for update;
  if not found or a.status not in ('SUBMITTED','RESUBMITTED') then raise exception 'REVIEW_NOT_ALLOWED'; end if;
  expected_count := case when a.type = 'INDIVIDUAL' then 3 else 2 end;
  if jsonb_array_length(decisions) <> expected_count or
    (select count(distinct value->>'fileId') from jsonb_array_elements(decisions)) <> expected_count
    then raise exception 'REQUIRED_FILES_MISSING'; end if;
  for d in select value from jsonb_array_elements(decisions) loop
    if not exists (select 1 from public.application_files where id = (d->>'fileId')::uuid and application_id = a.id)
      then raise exception 'FILE_NOT_FOUND'; end if;
    perform public.review_application_file((d->>'fileId')::uuid,actor_id,(d->>'action')::public.review_action,d->>'note');
  end loop;
  update public.applications set rejection_reason = (select string_agg(feedback_note, E'\n')
    from public.application_files where application_id = a.id and review_status = 'REJECTED')
    where id = a.id returning * into a;
  return a;
end; $$;
revoke all on function public.finalize_review(uuid,uuid,jsonb) from public, anon, authenticated;
grant execute on function public.finalize_review(uuid,uuid,jsonb) to service_role;
revoke all on function public.storage_committed_bytes(), public.storage_reserved_bytes() from public, anon, authenticated;
grant execute on function public.storage_committed_bytes(), public.storage_reserved_bytes() to service_role;
commit;
