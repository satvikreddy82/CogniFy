-- ============================================================
-- CogniFy Seed Data — Development Only
-- ============================================================

-- Departments (14 Accredited Academic Disciplines)
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

-- NOTE: The first admin is created via the bootstrap CLI script.
-- See docs/setup.md for instructions.
-- In development only, you can insert manually (hash = bcrypt of "Admin@123"):
-- insert into profiles (id, email, full_name, role, password_hash, is_active, status)
-- values (
--   gen_random_uuid(),
--   'admin@cognify.edu',
--   'System Admin',
--   'admin',
--   '$2b$12$rw/0YhVPP9oDBsH3bxvqeOgQoO5y6YZ8cA4k4sLnKQPHPHwOEZNRC', -- Admin@123
--   true,
--   'approved'
-- );
