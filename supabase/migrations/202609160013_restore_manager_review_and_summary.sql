-- Restore manager RPCs and their review dependency from migrations 007/008.
-- Preserve atomic review, faculty scope and service-role-only execution.
begin;

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
create or replace function public.application_summary(target_campaign_id uuid, actor_id uuid, target_faculty_id uuid default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor public.users%rowtype; scope uuid; result jsonb;
begin
  select * into actor from public.users where id = actor_id and is_active;
  if not found or actor.role not in ('FACULTY_SECRETARY','SCHOOL_PRESIDENT','SUPER_ADMIN') then raise exception 'FORBIDDEN'; end if;
  scope := case when actor.role = 'FACULTY_SECRETARY' then actor.faculty_id else target_faculty_id end;
  if exists(select 1 from public.campaigns where id = target_campaign_id and is_archived) then
    select jsonb_build_object('totalSubmitted',coalesce(sum(total_submitted),0),'pending',coalesce(sum(total_pending),0),
      'resubmitRequired',coalesce(sum(total_resubmit),0),'approved',coalesce(sum(total_approved),0),'rejected',coalesce(sum(total_rejected),0),
      'faculties',coalesce(jsonb_agg(jsonb_build_object('name',f.name,'total',s.total_submitted,'approved',s.total_approved)),'[]'::jsonb)) into result
    from public.campaign_statistics s join public.faculties f on f.id=s.faculty_id
    where s.campaign_id=target_campaign_id and (scope is null or s.faculty_id=scope);
  else
    select jsonb_build_object('totalSubmitted',count(*),'pending',count(*) filter(where a.status in ('SUBMITTED','RESUBMITTED')),
      'resubmitRequired',count(*) filter(where a.status='RESUBMIT_REQUIRED'),'approved',count(*) filter(where a.status='APPROVED'),
      'rejected',count(*) filter(where a.status='REJECTED')) into result
    from public.applications a join public.users u on u.id=a.user_id
    where a.campaign_id=target_campaign_id and a.status<>'DRAFT' and (scope is null or u.faculty_id=scope);
    result := result || jsonb_build_object('faculties',(select coalesce(jsonb_agg(t),'[]'::jsonb) from (
      select f.name,count(a.id) as total,count(a.id) filter(where a.status='APPROVED') as approved
      from public.faculties f left join public.users u on u.faculty_id=f.id
      left join public.applications a on a.user_id=u.id and a.campaign_id=target_campaign_id and a.status<>'DRAFT'
      where scope is null or f.id=scope group by f.id,f.name order by f.name
    ) t));
  end if;
  return result;
end; $$;
revoke all on function public.application_summary(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.application_summary(uuid,uuid,uuid) to service_role;

notify pgrst, 'reload schema';
commit;
