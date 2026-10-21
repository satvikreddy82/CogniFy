-- ============================================================
-- CogniFy Seed Data — Official Academic Departments (14 Disciplines)
-- Run in Supabase SQL Editor or psql to populate accredited departments
-- ============================================================

create table if not exists departments (
  id text primary key,
  name text unique not null,
  created_at timestamptz not null default now()
);

insert into departments (id, name) values
  ('dept-01', 'Computer Science & Engineering (CSE)'),
  ('dept-02', 'Information Technology (IT)'),
  ('dept-03', 'Electronics & Communication Engineering (ECE)'),
  ('dept-04', 'Electrical & Electronics Engineering (EEE)'),
  ('dept-05', 'Mechanical Engineering'),
  ('dept-06', 'Civil Engineering'),
  ('dept-07', 'Artificial Intelligence & Data Science (AI & DS)'),
  ('dept-08', 'Biotechnology'),
  ('dept-09', 'Chemical Engineering'),
  ('dept-10', 'Aerospace Engineering'),
  ('dept-11', 'Mechatronics'),
  ('dept-12', 'Robotics & Artificial Intelligence'),
  ('dept-13', 'Electronics & Instrumentation Engineering (EIE)'),
  ('dept-14', 'Bioinformatics')
on conflict (id) do update set name = excluded.name;
