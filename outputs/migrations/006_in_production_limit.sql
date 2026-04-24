-- Task 4 — per-client in_production_limit column
-- Run against the shared Supabase project. Additive only.
--
-- What this adds:
--   * clients.in_production_limit (int, 1–10, default 1)
--
-- Default value is 1 so existing behaviour (one brief in production per
-- client at a time) is preserved for every client already in the table.
-- The CHECK constraint caps the range to [1, 10] so the UI stepper and
-- the DB agree.
--
-- This column is read by Task 5's auto_promote_backlog() function.

alter table public.clients
  add column if not exists in_production_limit integer
    not null
    default 1
    check (in_production_limit between 1 and 10);
