begin;

create table public.student_notifications (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique,
  author_id uuid references public.users(id) on delete set null,
  author_name text not null,
  title text not null check (char_length(trim(title)) between 2 and 160),
  body text not null check (char_length(trim(body)) between 1 and 10000),
  created_at timestamptz not null default now()
);
create index student_notifications_recent on public.student_notifications(created_at desc, id desc);

create table public.student_notification_reads (
  user_id uuid not null references public.users(id) on delete cascade,
  notification_id uuid not null references public.student_notifications(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (user_id, notification_id)
);

alter table public.student_notifications enable row level security;
alter table public.student_notification_reads enable row level security;
revoke all on public.student_notifications, public.student_notification_reads from anon, authenticated;
grant select on public.student_notifications, public.student_notification_reads to authenticated;
create policy notifications_read on public.student_notifications for select to authenticated
  using (public.current_user_role() in ('STUDENT', 'SCHOOL_PRESIDENT'));
create policy notification_reads_self on public.student_notification_reads for select to authenticated
  using (user_id = auth.uid() and public.current_user_role() = 'STUDENT');

create function public.publish_student_notification(p_request_id uuid, p_title text, p_body text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  actor public.users%rowtype;
  notice public.student_notifications%rowtype;
  notice_id uuid;
begin
  select * into actor from public.users
    where id = auth.uid() and role = 'SCHOOL_PRESIDENT' and is_active for share;
  if not found then raise exception 'FORBIDDEN'; end if;

  insert into public.student_notifications(request_id, author_id, author_name, title, body)
  values (p_request_id, actor.id, actor.full_name, trim(p_title), trim(p_body))
  on conflict (request_id) do nothing returning id into notice_id;
  if notice_id is null then
    select * into notice from public.student_notifications where request_id = p_request_id;
    if notice.author_id is distinct from actor.id or notice.title <> trim(p_title) or notice.body <> trim(p_body) then
      raise exception 'NOTIFICATION_REQUEST_CONFLICT';
    end if;
    return notice.id;
  end if;
  insert into public.system_audit_logs(user_id, actor_snapshot, action, resource_type, resource_id, metadata)
  values (actor.id, jsonb_build_object('role', actor.role, 'full_name', actor.full_name),
    'PUBLISH_STUDENT_NOTIFICATION', 'student_notification', notice_id, jsonb_build_object('title', trim(p_title)));
  return notice_id;
end;
$$;

create function public.read_student_notification(p_notification_id uuid)
returns timestamptz language plpgsql security definer set search_path = '' as $$
declare marked_at timestamptz;
begin
  perform 1 from public.users where id = auth.uid() and role = 'STUDENT' and is_active for share;
  if not found then raise exception 'FORBIDDEN'; end if;
  if not exists (select 1 from public.student_notifications where id = p_notification_id) then
    raise exception 'NOTIFICATION_NOT_FOUND';
  end if;
  insert into public.student_notification_reads(user_id, notification_id)
    values (auth.uid(), p_notification_id) on conflict do nothing;
  select read_at into marked_at from public.student_notification_reads
    where user_id = auth.uid() and notification_id = p_notification_id;
  return marked_at;
end;
$$;

create function public.student_notification_unread_count()
returns bigint language plpgsql stable security definer set search_path = '' as $$
begin
  if public.current_user_role() is distinct from 'STUDENT'::public.user_role then
    raise exception 'FORBIDDEN';
  end if;
  return (select count(*) from public.student_notifications n where not exists (
    select 1 from public.student_notification_reads r where r.user_id = auth.uid() and r.notification_id = n.id
  ));
end;
$$;

create function public.student_notifications_page(p_page integer default 1)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if coalesce(public.current_user_role() in ('STUDENT', 'SCHOOL_PRESIDENT'), false) = false then
    raise exception 'FORBIDDEN';
  end if;
  if p_page is null or p_page < 1 or p_page > 100000 then raise exception 'INVALID_NOTIFICATION_PAGE'; end if;
  return jsonb_build_object(
    'total', (select count(*) from public.student_notifications),
    'items', coalesce((select jsonb_agg(to_jsonb(item) order by item.created_at desc, item.id desc) from (
      select n.id, n.title, n.body, n.author_name, n.created_at, r.read_at
      from public.student_notifications n
      left join public.student_notification_reads r on r.notification_id = n.id and r.user_id = auth.uid()
      order by n.created_at desc, n.id desc limit 20 offset (p_page - 1) * 20
    ) item), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.publish_student_notification(uuid, text, text),
  public.read_student_notification(uuid), public.student_notification_unread_count(),
  public.student_notifications_page(integer) from public, anon, authenticated;
grant execute on function public.publish_student_notification(uuid, text, text),
  public.read_student_notification(uuid), public.student_notification_unread_count(),
  public.student_notifications_page(integer) to authenticated;

-- Read receipts remain private through RLS; inserts synchronize the student's tabs.
alter publication supabase_realtime add table public.student_notifications, public.student_notification_reads;
commit;
