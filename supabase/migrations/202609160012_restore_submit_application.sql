-- Restore the submit RPC on databases missing the function from migration 007.
-- Keep submission atomic, with ownership, campaign, upload and file checks.
begin;

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

notify pgrst, 'reload schema';
commit;
