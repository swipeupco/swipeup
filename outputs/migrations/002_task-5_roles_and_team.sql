-- Task 5 — Roles + Team management
-- Run against the shared Supabase project. Additive only. Safe for Portal.
--
-- Adds:
--   1. profiles.hub_role (text, check-constrained to 'admin' | 'designer')
--   2. staff_default_assignments (many-to-many: staff_id × client_id)
--   3. RLS policies on staff_default_assignments (admin-only write, self-read)
--
-- Does NOT drop client_assignments (the existing single-assignee table).
-- staff_default_assignments is the new source of truth for default
-- auto-tagging; client_assignments is retained for backward compat so any
-- other code path that reads it keeps working.

-- 1. hub_role column ---------------------------------------------------------

alter table public.profiles
  add column if not exists hub_role text
    check (hub_role in ('admin', 'designer'))
    default 'designer';

-- Backfill Eden as admin. Uses auth.users for email lookup so this still works
-- if profiles doesn't carry email directly.
update public.profiles
   set hub_role = 'admin'
 where id in (
   select id from auth.users where lower(email) = 'eden@swipeupco.com'
 );

-- Any existing staff members (is_staff or is_admin) default to designer via
-- the column default, EXCEPT is_admin=true users who should migrate to admin.
update public.profiles
   set hub_role = 'admin'
 where (is_admin = true or hub_role is null)
   and id in (select id from auth.users where lower(email) = 'eden@swipeupco.com');

-- For everyone else who was previously is_admin=true, give them admin too.
update public.profiles
   set hub_role = 'admin'
 where is_admin = true
   and (hub_role is null or hub_role = 'designer');

-- 2. staff_default_assignments ----------------------------------------------

create table if not exists public.staff_default_assignments (
  staff_id   uuid not null references auth.users(id) on delete cascade,
  client_id  uuid not null references public.clients(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (staff_id, client_id)
);

-- Small index for "which staff are default-assigned to this client?" lookup
create index if not exists idx_sda_client_id on public.staff_default_assignments (client_id);

-- 3. RLS ---------------------------------------------------------------------

alter table public.staff_default_assignments enable row level security;

-- Allow admins to read / write any row.
drop policy if exists sda_admin_all on public.staff_default_assignments;
create policy sda_admin_all on public.staff_default_assignments
  for all
  using (
    exists (
      select 1 from public.profiles
       where id = auth.uid()
         and (hub_role = 'admin' or is_admin = true)
    )
  )
  with check (
    exists (
      select 1 from public.profiles
       where id = auth.uid()
         and (hub_role = 'admin' or is_admin = true)
    )
  );

-- Allow a staff member to see their own default-assignments.
drop policy if exists sda_self_read on public.staff_default_assignments;
create policy sda_self_read on public.staff_default_assignments
  for select
  using (staff_id = auth.uid());
