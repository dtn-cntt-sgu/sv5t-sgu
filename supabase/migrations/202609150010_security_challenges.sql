begin;
-- The one-time secret is managed and verified by Supabase Auth, never stored in our database.
-- code_hash contains provider state only: PROVIDER_PENDING / VERIFIED.
create or replace function public.create_security_challenge(actor_id uuid,target_purpose text,target_resource uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
  perform 1 from public.users where id=actor_id and is_active and role in ('SCHOOL_PRESIDENT','SUPER_ADMIN') for update;
  if not found then raise exception 'FORBIDDEN'; end if;
  if exists(select 1 from public.security_challenges where user_id=actor_id and created_at>now()-interval '60 seconds') then raise exception 'OTP_RATE_LIMIT'; end if;
  update public.security_challenges set consumed_at=now() where user_id=actor_id and consumed_at is null;
  insert into public.security_challenges(user_id,purpose,resource_id,code_hash,expires_at)
    values(actor_id,target_purpose,target_resource,'PROVIDER_PENDING',now()+interval '5 minutes') returning id into result;
  return result;
end; $$;
create or replace function public.attempt_security_challenge(target_id uuid,actor_id uuid) returns public.security_challenges
language plpgsql security definer set search_path='' as $$
declare result public.security_challenges%rowtype;
begin
  update public.security_challenges set attempts=attempts+1 where id=target_id and user_id=actor_id and consumed_at is null
    and expires_at>now() and attempts<5 and code_hash='PROVIDER_PENDING' returning * into result;
  return result;
end; $$;
revoke all on function public.create_security_challenge(uuid,text,uuid),public.attempt_security_challenge(uuid,uuid) from public,anon,authenticated;
grant execute on function public.create_security_challenge(uuid,text,uuid),public.attempt_security_challenge(uuid,uuid) to service_role;
commit;
