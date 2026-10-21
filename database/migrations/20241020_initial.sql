-- ============================================================
-- CogniFy Database Migration — Initial Schema
-- Apply via: psql -d your_db -f this_file.sql
--         or: Supabase Dashboard > SQL Editor
-- ============================================================

-- Extensions
create extension if not exists "pgcrypto";

-- ─── Departments ─────────────────────────────────────────────────────────────
create table if not exists departments (
  id text primary key,
  name text unique not null,
  created_at timestamptz not null default now()
);

-- ─── Profiles (all users) ─────────────────────────────────────────────────────
create table if not exists profiles (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  full_name text not null,
  employee_id text,
  role text not null check (role in ('admin', 'dean', 'faculty')),
  department_id text references departments(id),
  designation text,
  password_hash text not null,
  theme text default 'theme-a',
  appearance text default 'system' check (appearance in ('light', 'dark', 'system')),
  is_active boolean not null default false,
  status text not null default 'pending_approval'
    check (status in ('pending_approval', 'email_verification', 'approved', 'rejected', 'suspended', 'revoked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─── Registration Applications ────────────────────────────────────────────────
create table if not exists registration_applications (
  id uuid primary key default gen_random_uuid(),
  applicant_id uuid not null references profiles(id),
  applicant_role text not null check (applicant_role in ('faculty', 'dean')),
  department_id text references departments(id),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'clarification_requested')),
  decided_by uuid references profiles(id),
  decision_reason text,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

-- ─── Password Reset OTPs ──────────────────────────────────────────────────────
create table if not exists password_reset_otps (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id),
  otp_hash text not null,
  expires_at timestamptz not null,
  attempts int not null default 0,
  used boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_otp_profile on password_reset_otps(profile_id);

-- ─── Courses ─────────────────────────────────────────────────────────────────
create table if not exists courses (
  id uuid primary key default gen_random_uuid(),
  department_id text references departments(id),
  code text not null,
  name text not null,
  term text,
  description text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(code, department_id)
);

-- ─── Syllabi ─────────────────────────────────────────────────────────────────
create table if not exists syllabi (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id) on delete cascade,
  file_path text,
  file_name text,
  file_type text,
  extracted_text text,
  extraction_status text default 'pending'
    check (extraction_status in ('pending', 'processing', 'completed', 'failed', 'needs_review')),
  uploaded_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

-- ─── Course Outcomes ──────────────────────────────────────────────────────────
create table if not exists course_outcomes (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id) on delete cascade,
  code text not null,
  description text not null,
  target_attainment numeric check (target_attainment between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─── Question Bank ────────────────────────────────────────────────────────────
create table if not exists question_bank_entries (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id),
  text text not null,
  bloom_level text check (bloom_level in ('remember','understand','apply','analyze','evaluate','create')),
  difficulty text check (difficulty in ('easy','medium','hard')),
  marks int,
  co_id uuid references course_outcomes(id),
  question_type text,
  source_file_path text,
  verification_status text default 'unverified'
    check (verification_status in ('unverified', 'verified', 'rejected')),
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_qbank_course on question_bank_entries(course_id);
create index if not exists idx_qbank_co on question_bank_entries(co_id);
create index if not exists idx_qbank_bloom on question_bank_entries(bloom_level);

-- ─── Papers ───────────────────────────────────────────────────────────────────
create table if not exists papers (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id),
  created_by uuid not null references profiles(id),
  title text not null,
  total_marks int not null default 0,
  duration_minutes int,
  status text not null default 'draft'
    check (status in ('draft','generating','validation_required','pending_review','changes_requested','approved','rejected','archived')),
  version int not null default 1,
  config jsonb,
  ai_metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_papers_course on papers(course_id);
create index if not exists idx_papers_status on papers(status);
create index if not exists idx_papers_creator on papers(created_by);

-- ─── Paper Questions ──────────────────────────────────────────────────────────
create table if not exists paper_questions (
  id uuid primary key default gen_random_uuid(),
  paper_id uuid not null references papers(id) on delete cascade,
  question_id uuid not null references question_bank_entries(id),
  order_index int not null,
  marks int not null,
  section text,
  unique(paper_id, question_id)
);

create index if not exists idx_pq_paper on paper_questions(paper_id);

-- ─── Approvals ────────────────────────────────────────────────────────────────
create table if not exists approvals (
  id uuid primary key default gen_random_uuid(),
  paper_id uuid not null references papers(id),
  dean_id uuid not null references profiles(id),
  decision text not null check (decision in ('approved','rejected','changes_requested')),
  comment text,
  created_at timestamptz not null default now()
);

-- ─── Assessments & Marks ──────────────────────────────────────────────────────
create table if not exists assessments (
  id uuid primary key default gen_random_uuid(),
  paper_id uuid not null references papers(id),
  student_id text not null,
  total_score numeric,
  created_at timestamptz not null default now(),
  unique(paper_id, student_id)
);

create index if not exists idx_assessments_paper on assessments(paper_id);

create table if not exists assessment_marks (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references assessments(id) on delete cascade,
  question_id uuid not null references question_bank_entries(id),
  score numeric not null,
  unique(assessment_id, question_id)
);

-- ─── Adaptive Recommendations ─────────────────────────────────────────────────
create table if not exists adaptive_recommendations (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id),
  generated_by uuid references profiles(id),
  co_id uuid references course_outcomes(id),
  attainment_percent numeric,
  recommendation text not null,
  evidence jsonb,
  faculty_decision text check (faculty_decision in ('accepted','rejected','modified')),
  faculty_note text,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

-- ─── AI Feedback ──────────────────────────────────────────────────────────────
create table if not exists ai_feedback (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id),
  original_suggestion jsonb,
  corrected_value jsonb,
  feedback_type text not null
    check (feedback_type in ('co_mapping','bloom_level','difficulty','question_edit','question_reject','recommendation')),
  question_id uuid references question_bank_entries(id),
  course_id uuid references courses(id),
  model_version text,
  created_at timestamptz not null default now()
);

-- ─── Notifications ────────────────────────────────────────────────────────────
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid references profiles(id),
  recipient_role text,
  department_id uuid references departments(id),
  type text not null,
  payload jsonb,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_notif_recipient on notifications(recipient_id);

-- ─── Audit Logs ───────────────────────────────────────────────────────────────
create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references profiles(id),
  action text not null,
  target_table text,
  target_id uuid,
  details jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_actor on audit_logs(actor_id);
create index if not exists idx_audit_action on audit_logs(action);

-- ─── Row Level Security (basic examples) ─────────────────────────────────────
-- Enable RLS on sensitive tables
alter table profiles enable row level security;
alter table assessment_marks enable row level security;
alter table audit_logs enable row level security;

-- Profiles: users can read own record via Supabase auth (server-side bypasses via service role)
create policy if not exists "profiles_self_read"
  on profiles for select
  using (auth.uid() = id);

-- Audit logs: only admins can read (enforced at API layer too)
-- (If using Supabase auth, add a "is_admin" check here)
