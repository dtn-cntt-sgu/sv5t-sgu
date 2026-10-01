begin;
create table public.qa_faqs (
  id uuid primary key,
  question text not null check (char_length(trim(question)) between 2 and 240),
  answer text not null check (char_length(trim(answer)) between 1 and 5000),
  position integer not null,
  version integer not null default 1,
  updated_at timestamptz not null default now()
);
create index qa_faq_order on public.qa_faqs(position, id);
create table public.qa_questions (
  id uuid primary key,
  student_id uuid not null references public.users(id) on delete cascade,
  student_name text not null,
  student_code text,
  question text not null check (char_length(trim(question)) between 2 and 3000),
  answer text check (answer is null or char_length(trim(answer)) between 1 and 5000),
  answered_by uuid references public.users(id) on delete set null,
  answered_name text,
  created_at timestamptz not null default now(),
  answered_at timestamptz,
  check ((answer is null) = (answered_at is null))
);
-- This constraint also protects against simultaneous requests from different tabs.
create unique index qa_one_waiting_question on public.qa_questions(student_id) where answer is null;
create index qa_questions_recent on public.qa_questions(created_at desc, id desc);
create index qa_questions_student on public.qa_questions(student_id, created_at desc);
alter table public.qa_faqs enable row level security;
alter table public.qa_questions enable row level security;
revoke all on public.qa_faqs, public.qa_questions from anon, authenticated;
grant select on public.qa_faqs, public.qa_questions to authenticated;
create policy qa_faq_read on public.qa_faqs for select to authenticated
  using (public.current_user_role() in ('STUDENT', 'SCHOOL_PRESIDENT'));
create policy qa_question_read on public.qa_questions for select to authenticated
  using (public.current_user_role() = 'SCHOOL_PRESIDENT' or
    (public.current_user_role() = 'STUDENT' and student_id = auth.uid()));

create function public.qa_manage_faq(p_action text, p_id uuid, p_question text default null,
  p_answer text default null, p_version integer default 0, p_direction integer default 0)
returns uuid language plpgsql security definer set search_path = '' as $$
declare current_faq public.qa_faqs%rowtype; neighbor public.qa_faqs%rowtype;
begin
  perform 1 from public.users where id = auth.uid() and role = 'SCHOOL_PRESIDENT' and is_active for share;
  if not found then raise exception 'FORBIDDEN'; end if;
  -- Serialize add/edit/delete/reorder so positions and version checks stay consistent.
  lock table public.qa_faqs in share row exclusive mode;
  select * into current_faq from public.qa_faqs where id = p_id;
  if p_action = 'save' and p_version = 0 then
    if found then
      if current_faq.question = trim(p_question) and current_faq.answer = trim(p_answer) then return p_id; end if;
      raise exception 'QA_CHANGED';
    end if;
    insert into public.qa_faqs(id, question, answer, position)
      values (p_id, trim(p_question), trim(p_answer), coalesce((select max(position) from public.qa_faqs), 0) + 1);
  else
    if not found then raise exception 'QA_NOT_FOUND'; end if;
    if p_version is distinct from current_faq.version then raise exception 'QA_CHANGED'; end if;
    if p_action = 'save' then
      update public.qa_faqs set question = trim(p_question), answer = trim(p_answer), version = version + 1, updated_at = now() where id = p_id;
    elsif p_action = 'delete' then
      delete from public.qa_faqs where id = p_id;
    elsif p_action = 'move' and p_direction in (-1, 1) then
      select * into neighbor from public.qa_faqs
        where (p_direction = -1 and position < current_faq.position) or (p_direction = 1 and position > current_faq.position)
        order by case when p_direction = -1 then -position else position end limit 1;
      if not found then return p_id; end if;
      update public.qa_faqs set position = case when id = p_id then neighbor.position else current_faq.position end,
        version = version + 1, updated_at = now() where id in (p_id, neighbor.id);
    else raise exception 'QA_INVALID_ACTION'; end if;
  end if;
  insert into public.system_audit_logs(user_id, actor_snapshot, action, resource_type, resource_id)
    values (auth.uid(), jsonb_build_object('role', 'SCHOOL_PRESIDENT'), 'QA_FAQ_' || upper(p_action), 'qa_faq', p_id);
  return p_id;
end;
$$;

create function public.qa_ask(p_id uuid, p_question text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare actor public.users%rowtype; existing public.qa_questions%rowtype;
begin
  select * into actor from public.users where id = auth.uid() and role = 'STUDENT' and is_active for update;
  if not found then raise exception 'FORBIDDEN'; end if;
  select * into existing from public.qa_questions where id = p_id;
  if found then
    if existing.student_id = actor.id and existing.question = trim(p_question) then return p_id; end if;
    raise exception 'QA_CHANGED';
  end if;
  if exists (select 1 from public.qa_questions where student_id = actor.id and answer is null) then
    raise exception 'QA_PENDING';
  end if;
  insert into public.qa_questions(id, student_id, student_name, student_code, question)
    values (p_id, actor.id, actor.full_name, actor.mssv, trim(p_question));
  return p_id;
end;
$$;

create function public.qa_answer(p_id uuid, p_answer text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare actor public.users%rowtype; question_row public.qa_questions%rowtype;
begin
  select * into actor from public.users where id = auth.uid() and role = 'SCHOOL_PRESIDENT' and is_active for share;
  if not found then raise exception 'FORBIDDEN'; end if;
  if p_answer is null or char_length(trim(p_answer)) not between 1 and 5000 then raise exception 'QA_INVALID_ANSWER'; end if;
  select * into question_row from public.qa_questions where id = p_id for update;
  if not found then raise exception 'QA_NOT_FOUND'; end if;
  if question_row.answer is not null then
    if question_row.answer = trim(p_answer) then return p_id; end if;
    raise exception 'QA_ANSWERED';
  end if;
  update public.qa_questions set answer = trim(p_answer), answered_by = actor.id,
    answered_name = actor.full_name, answered_at = now() where id = p_id;
  insert into public.system_audit_logs(user_id, actor_snapshot, action, resource_type, resource_id)
    values (actor.id, jsonb_build_object('role', actor.role), 'QA_ANSWER', 'qa_question', p_id);
  return p_id;
end;
$$;

create function public.qa_page(p_page integer default 1, p_filter text default 'all')
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare actor_role public.user_role; items jsonb; total bigint;
begin
  actor_role := public.current_user_role();
  if coalesce(actor_role in ('STUDENT', 'SCHOOL_PRESIDENT'), false) = false then raise exception 'FORBIDDEN'; end if;
  if p_page is null or p_page not between 1 and 100000 or p_filter is null or p_filter not in ('all', 'waiting', 'answered') then raise exception 'QA_INVALID_ACTION'; end if;
  select count(*) into total from public.qa_questions q
    where (actor_role = 'SCHOOL_PRESIDENT' or q.student_id = auth.uid())
    and (p_filter = 'all' or (p_filter = 'waiting' and q.answer is null) or (p_filter = 'answered' and q.answer is not null));
  select coalesce(jsonb_agg(to_jsonb(row) order by row.created_at desc, row.id desc), '[]'::jsonb) into items from (
    select id, student_name, student_code, question, answer, answered_name, created_at, answered_at
    from public.qa_questions q where (actor_role = 'SCHOOL_PRESIDENT' or q.student_id = auth.uid())
    and (p_filter = 'all' or (p_filter = 'waiting' and q.answer is null) or (p_filter = 'answered' and q.answer is not null))
    order by created_at desc, id desc limit 20 offset (p_page - 1) * 20
  ) row;
  return jsonb_build_object('faqs', coalesce((select jsonb_agg(to_jsonb(f) order by f.position, f.id) from public.qa_faqs f), '[]'::jsonb),
    'questions', items, 'total', total,
    'pending', exists (select 1 from public.qa_questions where student_id = auth.uid() and answer is null),
    'waiting', (select count(*) from public.qa_questions where answer is null and (actor_role = 'SCHOOL_PRESIDENT' or student_id = auth.uid())));
end;
$$;
revoke all on function public.qa_manage_faq(text, uuid, text, text, integer, integer), public.qa_ask(uuid, text),
  public.qa_answer(uuid, text), public.qa_page(integer, text) from public, anon, authenticated;
grant execute on function public.qa_manage_faq(text, uuid, text, text, integer, integer), public.qa_ask(uuid, text),
  public.qa_answer(uuid, text), public.qa_page(integer, text) to authenticated;
alter publication supabase_realtime add table public.qa_faqs, public.qa_questions;
commit;
