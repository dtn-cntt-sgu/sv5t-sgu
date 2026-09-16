-- Auth Admin createUser inserts auth.users BEFORE applying app_metadata.
-- Create the public profile at commit, after the trusted role is available.
-- Keep all profile constraints and never trust user_metadata for roles.

begin;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  auth_user auth.users%rowtype;
  requested_role public.user_role;
begin
  -- NEW is the original INSERT snapshot, even for a deferred trigger.
  -- Re-read the row to see app_metadata written later in the transaction.
  select * into auth_user from auth.users where id = new.id;
  if not found then
    return new; -- The auth user was deleted within the same transaction.
  end if;

  requested_role := case
    when auth_user.raw_app_meta_data ->> 'role' in ('FACULTY_SECRETARY', 'SCHOOL_PRESIDENT', 'SUPER_ADMIN')
      then (auth_user.raw_app_meta_data ->> 'role')::public.user_role
    else 'STUDENT'::public.user_role
  end;

  insert into public.users (
    id, mssv, full_name, email, phone, role, faculty_id, major_id, class_name
  ) values (
    auth_user.id,
    nullif(upper(trim(auth_user.raw_user_meta_data ->> 'mssv')), ''),
    coalesce(nullif(trim(auth_user.raw_user_meta_data ->> 'full_name'), ''), 'Chưa cập nhật'),
    lower(auth_user.email),
    nullif(regexp_replace(auth_user.raw_user_meta_data ->> 'phone', '[^0-9+]', '', 'g'), ''),
    requested_role,
    nullif(auth_user.raw_user_meta_data ->> 'faculty_id', '')::uuid,
    nullif(auth_user.raw_user_meta_data ->> 'major_id', '')::uuid,
    nullif(upper(trim(auth_user.raw_user_meta_data ->> 'class_name')), '')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create constraint trigger on_auth_user_created
after insert on auth.users
deferrable initially deferred
for each row execute function public.handle_new_auth_user();

revoke all on function public.handle_new_auth_user() from public, anon, authenticated;

commit;
