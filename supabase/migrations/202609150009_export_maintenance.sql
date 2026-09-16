begin;
alter table public.campaigns add column maintenance_locked boolean not null default false;
alter table public.campaign_exports add column started_at timestamptz, add column worker_token uuid,
  add column heartbeat_at timestamptz, add column cleanup_status text not null default 'NONE' check(cleanup_status in ('NONE','PENDING','RUNNING','DONE','FAILED'));
create unique index one_export_processing on public.campaign_exports(campaign_id) where status='PROCESSING';
create or replace function public.queue_campaign_export(target_campaign_id uuid,actor_id uuid) returns public.campaign_exports
language plpgsql security definer set search_path='' as $$
declare c public.campaigns%rowtype; result public.campaign_exports%rowtype;
begin
  if not exists(select 1 from public.users where id=actor_id and role in ('SCHOOL_PRESIDENT','SUPER_ADMIN') and is_active) then raise exception 'FORBIDDEN'; end if;
  select * into c from public.campaigns where id=target_campaign_id for update;
  if not found or c.is_archived or c.is_active or c.end_date>=now() then raise exception 'CAMPAIGN_MUST_BE_CLOSED'; end if;
  if exists(select 1 from public.upload_reservations r join public.applications a on a.id=r.application_id
    where a.campaign_id=c.id and r.completed_at is null and r.expires_at>now()) then raise exception 'UPLOAD_IN_PROGRESS'; end if;
  update public.campaigns set maintenance_locked=true where id=c.id;
  insert into public.campaign_exports(campaign_id,requested_by) values(c.id,actor_id) returning * into result;
  insert into public.system_audit_logs(user_id,action,resource_type,resource_id) values(actor_id,'QUEUE_EXPORT','campaign',c.id);
  return result;
end; $$;
create or replace function public.guard_maintenance() returns trigger language plpgsql security definer set search_path='' as $$
declare campaign uuid;
begin
  if current_setting('sv5t.maintenance',true)='on' then return coalesce(new,old); end if;
  if tg_table_name='applications' then campaign:=coalesce(new.campaign_id,old.campaign_id);
  else select campaign_id into campaign from public.applications where id=coalesce(new.application_id,old.application_id); end if;
  perform 1 from public.campaigns where id=campaign for share;
  if exists(select 1 from public.campaigns where id=campaign and maintenance_locked) then raise exception 'CAMPAIGN_LOCKED_FOR_EXPORT'; end if;
  return coalesce(new,old);
end; $$;
create trigger application_maintenance before insert or update or delete on public.applications for each row execute function public.guard_maintenance();
create trigger file_maintenance before insert or update or delete on public.application_files for each row execute function public.guard_maintenance();
create or replace function public.claim_export(worker_id uuid) returns public.campaign_exports language plpgsql security definer set search_path='' as $$
declare result public.campaign_exports%rowtype;
begin
  select * into result from public.campaign_exports where status='PROCESSING'
    and (worker_token is null or heartbeat_at<now()-interval '5 minutes') order by created_at for update skip locked limit 1;
  if not found then return null; end if;
  update public.campaign_exports set worker_token=worker_id,started_at=now(),heartbeat_at=now() where id=result.id returning * into result;
  return result;
end; $$;
create or replace function public.purge_verified_campaign(target_campaign_id uuid,actor_id uuid,challenge_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
  perform 1 from public.campaigns where id=target_campaign_id for update;
  if not exists(select 1 from public.users where id=actor_id and role in ('SCHOOL_PRESIDENT','SUPER_ADMIN') and is_active) then raise exception 'FORBIDDEN'; end if;
  update public.security_challenges set consumed_at=now() where id=challenge_id and user_id=actor_id
    and purpose='PURGE_CAMPAIGN' and resource_id=target_campaign_id and code_hash='VERIFIED'
    and consumed_at is null and expires_at>now();
  if not found then raise exception 'OTP_INVALID'; end if;
  perform set_config('sv5t.maintenance','on',true);
  perform public.archive_campaign(target_campaign_id,actor_id);
  update public.campaign_exports set cleanup_status='PENDING' where campaign_id=target_campaign_id and status='READY';
end; $$;
-- Only trusted backend/worker can call maintenance functions.
revoke all on function public.queue_campaign_export(uuid,uuid), public.claim_export(uuid),public.purge_verified_campaign(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.queue_campaign_export(uuid,uuid), public.claim_export(uuid),public.purge_verified_campaign(uuid,uuid,uuid) to service_role;
commit;
