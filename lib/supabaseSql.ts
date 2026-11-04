/**
 * Complete SQL statements required to initialize the Supabase database tables,
 * storage bucket, RLS policies, indexes, and seed roster for AttendPulse.
 */
export const SUPABASE_SETUP_SQL = `-- ==============================================================================
-- Hameem Textiles: Smart Biometric Attendance & Workforce Management Setup
-- Run this script in your Supabase SQL Editor: Dashboard -> SQL Editor -> New query
-- ==============================================================================

-- 1. Enable UUID Extension if not already active
create extension if not exists "uuid-ossp";

-- 2. Create the 'employees' table (with Department, Designation, Password, and Manager support)
create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  employee_id text not null unique,
  name text not null,
  department text not null default 'Operations',
  designation text not null default 'Staff Member',
  password text not null default 'password123',
  photo_url text,
  face_descriptor float8[], -- 128-element biometric vector (populated upon face enrollment)
  enrolled boolean not null default false,
  is_manager boolean not null default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Index for instant lookup by Employee ID during Sign In and Sign Up
create index if not exists idx_employees_emp_id on public.employees (lower(employee_id));

-- 3. Create the 'office_locations' table (Optional geofence configuration)
create table if not exists public.office_locations (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Headquarters',
  latitude float8 not null default 37.7749,
  longitude float8 not null default -122.4194,
  radius_meters integer not null default 200,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Insert default headquarters location if none exists
insert into public.office_locations (name, latitude, longitude, radius_meters)
select 'Tech HQ (Main Office)', 37.7749, -122.4194, 200
where not exists (select 1 from public.office_locations limit 1);

-- 4. Create the 'attendance_logs' table (Tracks Check-In & Check-Out times, metrics, and punch type)
create table if not exists public.attendance_logs (
  id uuid primary key default gen_random_uuid(),
  employee_id text not null,
  punch_type text not null default 'check_in' check (punch_type in ('check_in', 'check_out')),
  captured_at timestamp with time zone default timezone('utc'::text, now()) not null,
  latitude float8,
  longitude float8,
  distance_meters float8,
  face_distance float8,
  status text not null check (status in ('present', 'face_mismatch', 'location_failed')),
  failure_reason text
);

-- Indices for rapid querying of daily punches and employee historical timesheets
create index if not exists idx_attendance_logs_emp_date 
  on public.attendance_logs (lower(employee_id), captured_at desc);

create index if not exists idx_attendance_logs_captured 
  on public.attendance_logs (captured_at desc);

create index if not exists idx_attendance_logs_status 
  on public.attendance_logs (status);

-- 5. Set up the 'employee_photos' Storage Bucket
insert into storage.buckets (id, name, public)
values ('employee_photos', 'employee_photos', true)
on conflict (id) do update set public = true;

-- 6. Storage Security Policies (Permit public view and employee photo uploads)
drop policy if exists "Public Access employee_photos" on storage.objects;
create policy "Public Access employee_photos"
  on storage.objects for select
  using (bucket_id = 'employee_photos');

drop policy if exists "Allow Upload employee_photos" on storage.objects;
create policy "Allow Upload employee_photos"
  on storage.objects for insert
  with check (bucket_id = 'employee_photos');

drop policy if exists "Allow Update employee_photos" on storage.objects;
create policy "Allow Update employee_photos"
  on storage.objects for update
  using (bucket_id = 'employee_photos');

-- 7. Table Row Level Security (RLS) Configuration
alter table public.employees enable row level security;
alter table public.office_locations enable row level security;
alter table public.attendance_logs enable row level security;

-- Employees policies (Allow read, insert, and update for workforce portal and manager spreadsheet sync)
drop policy if exists "Allow all read on employees" on public.employees;
create policy "Allow all read on employees"
  on public.employees for select using (true);

drop policy if exists "Allow all insert on employees" on public.employees;
create policy "Allow all insert on employees"
  on public.employees for insert with check (true);

drop policy if exists "Allow all update on employees" on public.employees;
create policy "Allow all update on employees"
  on public.employees for update using (true);

-- Office locations policies
drop policy if exists "Allow all read on office_locations" on public.office_locations;
create policy "Allow all read on office_locations"
  on public.office_locations for select using (true);

drop policy if exists "Allow all write on office_locations" on public.office_locations;
create policy "Allow all write on office_locations"
  on public.office_locations for all using (true);

-- Attendance logs policies
drop policy if exists "Allow all read on attendance_logs" on public.attendance_logs;
create policy "Allow all read on attendance_logs"
  on public.attendance_logs for select using (true);

drop policy if exists "Allow all insert on attendance_logs" on public.attendance_logs;
create policy "Allow all insert on attendance_logs"
  on public.attendance_logs for insert with check (true);

-- 8. Seed Default Manager Account and Corporate Roster
-- Manager: ID 'manager101', Password 'manager'
insert into public.employees (employee_id, name, department, designation, password, is_manager, enrolled)
values 
  ('MANAGER101', 'System Administrator & Manager', 'Corporate Administration', 'Operations Manager', 'manager', true, true)
on conflict (employee_id) do update set
  is_manager = true,
  password = excluded.password,
  department = excluded.department,
  designation = excluded.designation;

-- Seed Corporate Employees (Ready for Biometric Sign Up)
insert into public.employees (employee_id, name, department, designation, password, enrolled, photo_url)
values
  ('EMP-101', 'Sarah Connor', 'Engineering', 'Senior Lead Engineer', 'password123', false, null),
  ('EMP-204', 'Ankon Roy', 'Product & Design', 'Product Lead', 'password123', false, null),
  ('EMP-102', 'John Connor', 'Security & Operations', 'Systems Administrator', 'password123', false, null),
  ('EMP-301', 'Emily Davis', 'Human Resources', 'HR Specialist', 'password123', false, null),
  ('EMP-302', 'Michael Scott', 'Operations', 'Regional Director', 'password123', false, null),
  ('EMP-303', 'Dwight Schrute', 'Sales', 'Assistant to Regional Director', 'password123', false, null),
  ('EMP-304', 'Jim Halpert', 'Sales', 'Senior Account Executive', 'password123', false, null),
  ('EMP-305', 'Pam Beesly', 'Administration', 'Office Manager', 'password123', false, null),
  ('EMP-306', 'Stanley Hudson', 'Sales', 'Sales Representative', 'password123', false, null),
  ('EMP-307', 'Kevin Malone', 'Finance', 'Senior Accountant', 'password123', false, null)
on conflict (employee_id) do update set
  name = excluded.name,
  department = excluded.department,
  designation = excluded.designation;
`;
