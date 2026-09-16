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
