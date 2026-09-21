begin;
alter table public.campaign_exports
  add column storage_backend text not null default 'R2' check(storage_backend in ('R2','LOCAL')),
  add column local_archive_key text,
  add column archive_bytes bigint check(archive_bytes >= 0),
  add column archive_sha256 text,
  add column backup_confirmed_at timestamptz,
  add column cleanup_requested_by uuid references public.users(id) on delete set null,
  add column cleanup_worker_token uuid,
  add column cleanup_heartbeat_at timestamptz,
  add column cleanup_retry_at timestamptz,
  add column cleanup_error text;
-- Existing R2 archives keep their original backend. Only new jobs default to LOCAL.
alter table public.campaign_exports alter column storage_backend set default 'LOCAL';
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
      and ((storage_backend='R2' and manifest_r2_key is not null and archive_r2_key is not null)
        or (storage_backend='LOCAL' and local_archive_key is not null and archive_sha256 is not null))
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


-- Cleanup starts only after explicit confirmation and a verified OTP. Keep the
-- application rows (and their quota accounting) until R2 deletion completes.
drop function public.purge_verified_campaign(uuid,uuid,uuid);
create function public.purge_verified_campaign(target_campaign_id uuid,actor_id uuid,challenge_id uuid,target_export_id uuid,backup_confirmed boolean)
returns void language plpgsql security definer set search_path='' as $$
declare c public.campaigns%rowtype; e public.campaign_exports%rowtype;
begin
  select * into c from public.campaigns where id=target_campaign_id for update;
  if not exists(select 1 from public.users where id=actor_id and role in ('SCHOOL_PRESIDENT','SUPER_ADMIN') and is_active) then raise exception 'FORBIDDEN'; end if;
  if backup_confirmed is distinct from true then raise exception 'BACKUP_CONFIRMATION_REQUIRED'; end if;
  update public.security_challenges set consumed_at=now() where id=challenge_id and user_id=actor_id
    and purpose='PURGE_CAMPAIGN' and resource_id=target_campaign_id and code_hash='VERIFIED'
    and consumed_at is null and expires_at>now();
  if not found then raise exception 'OTP_INVALID'; end if;
  if c.id is null or c.is_active or c.is_archived or c.end_date>=now() then raise exception 'CAMPAIGN_MUST_BE_CLOSED'; end if;
  if exists(select 1 from public.campaign_exports where campaign_id=c.id and (status='PROCESSING' or cleanup_status<>'NONE')) then raise exception 'EXPORT_OR_CLEANUP_IN_PROGRESS'; end if;
  select * into e from public.campaign_exports where id=target_export_id and campaign_id=c.id and status='READY' for update;
  if not found or not ((e.storage_backend='LOCAL' and e.local_archive_key is not null and e.archive_sha256 is not null)
    or (e.storage_backend='R2' and e.archive_r2_key is not null and e.manifest_r2_key is not null)) then raise exception 'READY_EXPORT_REQUIRED'; end if;
  update public.campaigns set maintenance_locked=true where id=c.id;
  update public.campaign_exports set backup_confirmed_at=now(),cleanup_requested_by=actor_id,cleanup_status='PENDING' where id=e.id;
  insert into public.system_audit_logs(user_id,action,resource_type,resource_id) values(actor_id,'QUEUE_CAMPAIGN_CLEANUP','campaign',c.id);
end; $$;

create function public.claim_export_cleanup(worker_id uuid) returns public.campaign_exports
language plpgsql security definer set search_path='' as $$
declare result public.campaign_exports%rowtype;
begin
  select * into result from public.campaign_exports e where e.status='READY'
    and (e.cleanup_status='PENDING' or (e.cleanup_status='FAILED' and coalesce(e.cleanup_retry_at,now())<=now())
      or (e.cleanup_status='RUNNING' and coalesce(e.cleanup_heartbeat_at,'epoch')<now()-interval '5 minutes'))
    and not exists(select 1 from public.campaign_exports other where other.campaign_id=e.campaign_id and other.id<>e.id
      and other.cleanup_status='RUNNING' and other.cleanup_heartbeat_at>=now()-interval '5 minutes')
    order by created_at for update skip locked limit 1;
  if not found then return null; end if;
  update public.campaign_exports set cleanup_status='RUNNING',cleanup_worker_token=worker_id,
    cleanup_heartbeat_at=now(),cleanup_error=null where id=result.id returning * into result;
  return result;
end; $$;

create function public.finish_export_cleanup(target_export_id uuid,worker_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare e public.campaign_exports%rowtype; archived boolean;
begin
  select * into e from public.campaign_exports where id=target_export_id for update;
  if e.id is null or e.cleanup_worker_token is distinct from worker_id or e.cleanup_status<>'RUNNING'
    or e.cleanup_heartbeat_at<now()-interval '5 minutes' then raise exception 'CLEANUP_LEASE_LOST'; end if;
  select is_archived into archived from public.campaigns where id=e.campaign_id for update;
  -- Legacy jobs may already have removed their DB rows before migration 014.
  if not archived then
    perform set_config('sv5t.maintenance','on',true);
    perform public.archive_campaign(e.campaign_id,coalesce(e.cleanup_requested_by,e.requested_by));
  end if;
  update public.campaign_exports set cleanup_status='DONE',cleanup_heartbeat_at=now(),cleanup_error=null,
    cleanup_worker_token=null where id=e.id;
end; $$;

-- Do not create more exports while the evidence is being deleted.
create function public.guard_export_during_cleanup() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  perform 1 from public.campaigns where id=new.campaign_id for update;
  if exists(select 1 from public.campaign_exports where campaign_id=new.campaign_id and cleanup_status<>'NONE') then
    raise exception 'EXPORT_OR_CLEANUP_IN_PROGRESS';
  end if;
  return new;
end; $$;
create trigger export_cleanup_guard before insert on public.campaign_exports for each row execute function public.guard_export_during_cleanup();
revoke all on function public.purge_verified_campaign(uuid,uuid,uuid,uuid,boolean),public.claim_export_cleanup(uuid),public.finish_export_cleanup(uuid,uuid) from public,anon,authenticated;
grant execute on function public.purge_verified_campaign(uuid,uuid,uuid,uuid,boolean),public.claim_export_cleanup(uuid),public.finish_export_cleanup(uuid,uuid) to service_role;
commit;
