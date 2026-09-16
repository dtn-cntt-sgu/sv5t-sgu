begin;
-- Restrict template metadata (including URLs), not only the download UI.
drop policy documents_public_read on public.public_documents;
create policy documents_public_read on public.public_documents for select using (
  (is_published and (category <> 'TEMPLATE' or public.current_user_role() = 'STUDENT'))
  or public.current_user_role() in ('SCHOOL_PRESIDENT','SUPER_ADMIN')
);
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
create or replace function public.database_size_bytes() returns bigint language sql security definer set search_path='' as $$
  select pg_database_size(current_database());
$$;
revoke all on function public.database_size_bytes() from public,anon,authenticated;
grant execute on function public.database_size_bytes() to service_role;
-- Audit sensitive administrative changes in the same transaction as the mutation.
create or replace function public.audit_administration() returns trigger language plpgsql security definer set search_path='' as $$
declare actor uuid;
begin
  actor := coalesce(auth.uid(), case when tg_table_name='campaigns' then (to_jsonb(new)->>'created_by')::uuid else null end);
  insert into public.system_audit_logs(user_id,actor_snapshot,action,resource_type,resource_id,metadata)
  values(actor,jsonb_build_object('database_role',current_user),tg_op||'_'||upper(tg_table_name),tg_table_name,
    nullif(coalesce(to_jsonb(new)->>'id',to_jsonb(old)->>'id'),'')::uuid,
    jsonb_build_object('before',to_jsonb(old),'after',to_jsonb(new)));
  return coalesce(new,old);
end; $$;
create trigger audit_campaigns after insert or update or delete on public.campaigns for each row execute function public.audit_administration();
create trigger audit_settings after update on public.system_settings for each row execute function public.audit_administration();
create trigger audit_documents after insert or update or delete on public.public_documents for each row execute function public.audit_administration();
create trigger audit_faculties after insert or update or delete on public.faculties for each row execute function public.audit_administration();
create trigger audit_majors after insert or update or delete on public.majors for each row execute function public.audit_administration();
commit;
