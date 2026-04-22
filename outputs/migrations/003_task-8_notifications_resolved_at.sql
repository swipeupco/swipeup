-- Task 8 — notifications.resolved_at
-- Additive only. Safe for Portal (the Portal's notification-writing paths
-- don't need to change; they'll continue to insert rows with resolved_at
-- defaulting to NULL).

alter table public.notifications
  add column if not exists resolved_at timestamptz;

-- Index speeds up the bell's "unresolved only" query.
create index if not exists idx_notifications_unresolved
  on public.notifications (created_at desc)
  where resolved_at is null;
