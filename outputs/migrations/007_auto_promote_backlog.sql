-- Task 5 — Auto-promote backlog brief when an In Production slot frees up
-- Run against the shared Supabase project. Additive only (new function +
-- triggers; no existing column or behaviour changes).
--
-- Problem
-- -------
-- The Hub removed its Backlog column (Task 1). The Portal still shows a
-- Backlog column where clients queue work. Each client has an
-- in_production_limit (Task 4, default 1) controlling how many briefs
-- can be in production simultaneously. When one leaves production
-- (approved, pushed to client, deleted), the oldest backlog brief
-- should automatically fill the freed slot.
--
-- Solution
-- --------
-- 1. auto_promote_backlog(p_client_id) — promotes as many backlog briefs
--    as the client has free capacity.
-- 2. Trigger on briefs AFTER UPDATE OR DELETE — fires when a brief
--    leaves the in_production / qa_review states (or is deleted entirely).
-- 3. Trigger on clients AFTER UPDATE OF in_production_limit — fires when
--    an admin raises the cap, so any backlog briefs slide up immediately.
--
-- Invariants
-- ----------
-- * "in production" means pipeline_status IN ('in_production','qa_review').
--   client_review is *not* a slot — those briefs are out of the studio's
--   control and should not block the queue.
-- * Promoted briefs are selected oldest-first by (sort_order NULLS LAST,
--   created_at), matching how the Portal Backlog column renders them.
-- * No-op when free capacity ≤ 0 or when the backlog is empty.
-- * Pipeline_status and internal_status are always written together to
--   mirror lib/pipeline/updateBriefStatus.ts's invariant.

create or replace function public.auto_promote_backlog(p_client_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit      integer;
  v_in_prod    integer;
  v_free       integer;
begin
  -- Per-client cap. Missing rows default to 1 to match the column default.
  select coalesce(in_production_limit, 1)
    into v_limit
    from public.clients
   where id = p_client_id;

  if v_limit is null then
    return;
  end if;

  select count(*)
    into v_in_prod
    from public.briefs
   where client_id = p_client_id
     and pipeline_status in ('in_production', 'qa_review');

  v_free := v_limit - coalesce(v_in_prod, 0);
  if v_free <= 0 then
    return;
  end if;

  -- Promote the oldest v_free backlog briefs. Ordering mirrors the Portal
  -- Backlog column: explicit sort_order first, then creation time.
  update public.briefs
     set pipeline_status = 'in_production',
         internal_status = 'in_production'
   where id in (
     select id
       from public.briefs
      where client_id = p_client_id
        and pipeline_status = 'backlog'
      order by sort_order asc nulls last, created_at asc
      limit v_free
   );
end;
$$;

-- Trigger: briefs AFTER UPDATE/DELETE
-- Fires whenever something could free up a slot. We guard inside the
-- function rather than narrowing the WHEN clause so the logic stays in
-- one place and future status changes don't silently bypass it.
create or replace function public.briefs_auto_promote_trigger()
returns trigger
language plpgsql
as $$
declare
  v_client uuid;
begin
  if tg_op = 'DELETE' then
    v_client := old.client_id;
  else
    v_client := coalesce(new.client_id, old.client_id);
  end if;

  if v_client is not null then
    perform public.auto_promote_backlog(v_client);
  end if;

  return null;
end;
$$;

drop trigger if exists briefs_auto_promote on public.briefs;
create trigger briefs_auto_promote
  after update or delete on public.briefs
  for each row
  execute function public.briefs_auto_promote_trigger();

-- Trigger: clients AFTER UPDATE OF in_production_limit
-- Firing on every clients update would be wasteful; scope to the column
-- that actually changes capacity.
create or replace function public.clients_limit_change_trigger()
returns trigger
language plpgsql
as $$
begin
  if new.in_production_limit is distinct from old.in_production_limit then
    perform public.auto_promote_backlog(new.id);
  end if;
  return null;
end;
$$;

drop trigger if exists clients_limit_auto_promote on public.clients;
create trigger clients_limit_auto_promote
  after update of in_production_limit on public.clients
  for each row
  execute function public.clients_limit_change_trigger();

-- Manual test scenarios (run in SQL editor to verify)
-- ---------------------------------------------------
-- Scenario A: default limit = 1
--   Given: client has 1 brief in in_production and 2 in backlog
--   When:  the in_production brief is approved (pipeline_status='approved')
--   Then:  the oldest backlog brief flips to in_production automatically
--
-- Scenario B: limit raised from 1 → 3
--   Given: client has 1 in_production brief and 5 backlog briefs
--   When:  admin updates clients.in_production_limit from 1 to 3
--   Then:  2 more backlog briefs flip to in_production (total 3 in prod)
--
-- Scenario C: client_review is not a slot
--   Given: client has 1 brief with pipeline_status='client_review' and 1 in backlog
--   When:  nothing changes
--   Then:  nothing is promoted — client_review briefs do not count toward
--          the in-production cap. (client_review only blocks promotion if
--          an admin explicitly pulls it back with Request Revisions, which
--          goes through in_production first and triggers the normal path.)
--
-- Scenario D: brief deleted
--   Given: client has 1 in_production brief (its only one) and 1 in backlog
--   When:  the in_production brief is deleted
--   Then:  the backlog brief flips to in_production
