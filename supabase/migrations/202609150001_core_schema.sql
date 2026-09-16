-- SV5T core schema
-- Run with `supabase db push` or paste migrations into the Supabase SQL editor in order.

create extension if not exists pgcrypto;

create type public.user_role as enum (
  'STUDENT',
  'FACULTY_SECRETARY',
  'SCHOOL_PRESIDENT',
  'SUPER_ADMIN'
);

create type public.application_type as enum ('INDIVIDUAL', 'COLLECTIVE');

create type public.application_status as enum (
  'DRAFT',
  'SUBMITTED',
  'RESUBMIT_REQUIRED',
  'RESUBMITTED',
  'APPROVED',
  'REJECTED'
);

create type public.file_category as enum (
  'DECLARATION_DOC',
  'EVIDENCE_DOC',
  'PORTRAIT_IMG',
  'COLLECTIVE_DOC',
  'COLLECTIVE_IMG'
);

create type public.file_review_status as enum (
  'PENDING',
  'ACCEPTED',
  'REJECTED',
  'RESUBMIT_REQUIRED'
);

create type public.review_action as enum (
  'ACCEPT',
  'REJECT',
  'REQUEST_RESUBMISSION'
);

create type public.export_status as enum ('PROCESSING', 'READY', 'FAILED');

create table public.faculties (
  id uuid primary key default gen_random_uuid(),
  code varchar(20) not null unique check (code ~ '^[A-Z0-9_-]+$'),
  name varchar(150) not null,
  created_at timestamptz not null default now()
);

create table public.majors (
  id uuid primary key default gen_random_uuid(),
  faculty_id uuid not null references public.faculties(id) on delete restrict,
  code varchar(20) not null unique check (code ~ '^[A-Z0-9_-]+$'),
  name varchar(150) not null,
  created_at timestamptz not null default now(),
  unique (id, faculty_id)
);

create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  mssv varchar(20) unique check (mssv is null or mssv ~ '^[A-Za-z0-9_-]{5,20}$'),
  full_name varchar(100) not null check (char_length(trim(full_name)) between 2 and 100),
  email varchar(254) not null unique,
  phone varchar(15) check (phone is null or phone ~ '^\+?[0-9]{9,15}$'),
  role public.user_role not null default 'STUDENT',
  faculty_id uuid references public.faculties(id) on delete restrict,
  major_id uuid,
  class_name varchar(50),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint users_major_belongs_to_faculty
    foreign key (major_id, faculty_id) references public.majors(id, faculty_id) on delete restrict,
  constraint student_profile_is_complete check (
    role <> 'STUDENT'
    or (mssv is not null and faculty_id is not null and major_id is not null and class_name is not null)
  ),
  constraint secretary_has_faculty check (
    role <> 'FACULTY_SECRETARY' or faculty_id is not null
  )
);

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  name varchar(150) not null,
  academic_year varchar(20) not null check (academic_year ~ '^[0-9]{4}-[0-9]{4}$'),
  start_date timestamptz not null,
  end_date timestamptz not null,
  is_active boolean not null default false,
  is_archived boolean not null default false,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint campaign_dates_are_valid check (end_date > start_date),
  constraint archived_campaign_is_inactive check (not is_archived or not is_active)
);

create unique index only_one_active_campaign
  on public.campaigns (is_active)
  where is_active and not is_archived;

create table public.public_documents (
  id uuid primary key default gen_random_uuid(),
  title varchar(200) not null,
  description text,
  category varchar(30) not null check (category in ('CRITERIA', 'GUIDE', 'TEMPLATE', 'NOTICE')),
  external_url text,
  r2_key varchar(512),
  is_published boolean not null default false,
  sort_order integer not null default 0,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((external_url is not null)::integer + (r2_key is not null)::integer = 1)
);

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete restrict,
  user_id uuid not null references public.users(id) on delete cascade,
  type public.application_type not null,
  status public.application_status not null default 'DRAFT',
  rejection_reason text,
  submitted_at timestamptz,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (campaign_id, user_id, type),
  check ((status = 'DRAFT' and submitted_at is null) or status <> 'DRAFT')
);

create table public.application_files (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  file_type public.file_category not null,
  r2_key varchar(512) not null unique,
  original_name varchar(255) not null,
  mime_type varchar(100) not null,
  file_size_bytes bigint not null check (file_size_bytes > 0),
  r2_etag varchar(128),
  revision integer not null default 1 check (revision > 0),
  review_status public.file_review_status not null default 'PENDING',
  feedback_note text,
  uploaded_at timestamptz not null default now(),
  unique (application_id, file_type)
);

create table public.upload_reservations (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  file_type public.file_category not null,
  r2_key varchar(512) not null,
  original_name varchar(255) not null,
  mime_type varchar(100) not null,
  expected_size_bytes bigint not null check (expected_size_bytes > 0),
  replaced_size_bytes bigint not null default 0 check (replaced_size_bytes >= 0),
  expires_at timestamptz not null,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index one_open_reservation_per_file
  on public.upload_reservations(application_id, file_type)
  where completed_at is null;

create table public.file_review_logs (
  id uuid primary key default gen_random_uuid(),
  application_file_id uuid not null references public.application_files(id) on delete cascade,
  reviewer_id uuid references public.users(id) on delete set null,
  reviewer_snapshot jsonb not null default '{}'::jsonb,
  action public.review_action not null,
  previous_status public.file_review_status not null,
  new_status public.file_review_status not null,
  note text,
  created_at timestamptz not null default now(),
  check (action = 'ACCEPT' or char_length(trim(coalesce(note, ''))) >= 5)
);

create table public.campaign_exports (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  requested_by uuid references public.users(id) on delete set null,
  status public.export_status not null default 'PROCESSING',
  manifest_r2_key varchar(512),
  archive_r2_key varchar(512),
  record_count integer not null default 0,
  error_message text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table public.campaign_statistics (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  faculty_id uuid not null references public.faculties(id) on delete restrict,
  total_submitted integer not null default 0 check (total_submitted >= 0),
  total_pending integer not null default 0 check (total_pending >= 0),
  total_resubmit integer not null default 0 check (total_resubmit >= 0),
  total_approved integer not null default 0 check (total_approved >= 0),
  total_rejected integer not null default 0 check (total_rejected >= 0),
  archived_at timestamptz not null default now(),
  unique (campaign_id, faculty_id)
);

create table public.security_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  purpose varchar(40) not null check (purpose in ('PURGE_CAMPAIGN', 'CHANGE_ADMIN_PASSWORD')),
  resource_id uuid,
  code_hash text not null,
  attempts integer not null default 0 check (attempts between 0 and 5),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.system_audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete set null,
  actor_snapshot jsonb not null default '{}'::jsonb,
  action varchar(100) not null,
  resource_type varchar(50),
  resource_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  ip_address inet,
  created_at timestamptz not null default now()
);

create table public.system_settings (
  singleton boolean primary key default true check (singleton),
  r2_hard_limit_bytes bigint not null default 8589934592 check (r2_hard_limit_bytes > 0),
  r2_warning_percent smallint not null default 75 check (r2_warning_percent between 1 and 99),
  max_docx_bytes bigint not null default 15728640,
  max_image_bytes bigint not null default 8388608,
  updated_by uuid references public.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.system_settings(singleton) values (true);

create index users_role_faculty_idx on public.users(role, faculty_id);
create index users_search_idx on public.users(mssv, lower(full_name));
create index majors_faculty_idx on public.majors(faculty_id);
create index applications_campaign_status_idx on public.applications(campaign_id, status, updated_at desc);
create index applications_user_idx on public.applications(user_id, campaign_id);
create index application_files_application_idx on public.application_files(application_id);
create index review_logs_file_created_idx on public.file_review_logs(application_file_id, created_at desc);
create index audit_logs_created_idx on public.system_audit_logs(created_at desc);
create index upload_reservations_expiry_idx on public.upload_reservations(expires_at) where completed_at is null;
