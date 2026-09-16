-- RLS is defense-in-depth. Mutations flow through authenticated server Route Handlers.

alter table public.faculties enable row level security;
alter table public.majors enable row level security;
alter table public.users enable row level security;
alter table public.campaigns enable row level security;
alter table public.public_documents enable row level security;
alter table public.applications enable row level security;
alter table public.application_files enable row level security;
alter table public.upload_reservations enable row level security;
alter table public.file_review_logs enable row level security;
alter table public.campaign_exports enable row level security;
alter table public.campaign_statistics enable row level security;
alter table public.security_challenges enable row level security;
alter table public.system_audit_logs enable row level security;
alter table public.system_settings enable row level security;

create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.users where id = auth.uid() and is_active;
$$;

create or replace function public.current_user_faculty_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select faculty_id from public.users where id = auth.uid() and is_active;
$$;

create or replace function public.can_manage_application(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case public.current_user_role()
    when 'SUPER_ADMIN' then true
    when 'SCHOOL_PRESIDENT' then true
    when 'FACULTY_SECRETARY' then exists (
      select 1 from public.users applicant
      where applicant.id = target_user_id
        and applicant.faculty_id = public.current_user_faculty_id()
    )
    else false
  end;
$$;

revoke all on all tables in schema public from anon, authenticated;
grant select on public.faculties, public.majors to anon, authenticated;
grant select on public.campaigns, public.public_documents to anon, authenticated;
grant select on public.users, public.applications, public.application_files,
  public.file_review_logs, public.campaign_statistics to authenticated;
grant update(full_name, phone) on public.users to authenticated;

create policy faculties_public_read on public.faculties for select using (true);
create policy majors_public_read on public.majors for select using (true);
create policy active_campaign_public_read on public.campaigns for select
using ((is_active and not is_archived) or public.current_user_role() in ('FACULTY_SECRETARY', 'SCHOOL_PRESIDENT', 'SUPER_ADMIN'));
create policy documents_public_read on public.public_documents for select
using (is_published or public.current_user_role() in ('SCHOOL_PRESIDENT', 'SUPER_ADMIN'));

create policy users_read_scope on public.users for select using (
  id = auth.uid()
  or public.current_user_role() in ('SCHOOL_PRESIDENT', 'SUPER_ADMIN')
  or (public.current_user_role() = 'FACULTY_SECRETARY' and faculty_id = public.current_user_faculty_id())
);
create policy users_update_self on public.users for update
using (id = auth.uid()) with check (id = auth.uid());

create policy applications_read_scope on public.applications for select using (
  user_id = auth.uid() or public.can_manage_application(user_id)
);

create policy application_files_read_scope on public.application_files for select using (
  exists (
    select 1 from public.applications a
    where a.id = application_id
      and (a.user_id = auth.uid() or public.can_manage_application(a.user_id))
  )
);

create policy review_logs_read_scope on public.file_review_logs for select using (
  exists (
    select 1
    from public.application_files f
    join public.applications a on a.id = f.application_id
    where f.id = application_file_id
      and (a.user_id = auth.uid() or public.can_manage_application(a.user_id))
  )
);

create policy statistics_manager_read on public.campaign_statistics for select using (
  public.current_user_role() in ('SCHOOL_PRESIDENT', 'SUPER_ADMIN')
  or (public.current_user_role() = 'FACULTY_SECRETARY' and faculty_id = public.current_user_faculty_id())
);

revoke all on function public.current_user_role() from public;
revoke all on function public.current_user_faculty_id() from public;
revoke all on function public.can_manage_application(uuid) from public;
grant execute on function public.current_user_role(), public.current_user_faculty_id(),
  public.can_manage_application(uuid) to anon, authenticated, service_role;

