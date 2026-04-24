# Big Workflow Fix Pass

**Branch:** `polish-and-attachments`
**Date:** 2026-04-23
**Tip commit:** `ce74431`

Six connected tasks that reshape how the Hub treats the Backlog column,
approved briefs, and the per-client in-production cap. All builds pass
(`npm run build`), all commits pushed to `origin/polish-and-attachments`.
Main is untouched, Portal repo is untouched, all DB changes are additive.

## Task status

| # | Task | Commit | Status |
| --- | --- | --- | --- |
| 1 | Remove Hub Backlog column (3-column pipeline) | `ccbdb0f` | Done |
| 2 | Stop auto-demote when draft link removed | `b03fe3c` | Done |
| 3 | Hub drawer QA buttons (no Approve) | `cec4563` | Done |
| 4 | Per-client `in_production_limit` column + UI | `99160f5` | Done |
| 5 | Auto-promote backlog brief when slot opens | `b0e98cc` | Done |
| 6 | Re-run approved brief | `ce74431` | Done |

## Details

### Task 1 — Remove Hub Backlog column (`ccbdb0f`)
The Hub now only renders three columns on both `/pipeline` and
`/pipeline/[clientSlug]`: **In Production**, **Ready for Review**,
**Approved**. The Portal still owns the Backlog concept — briefs with
`pipeline_status='backlog'` are filtered out of Hub queries rather than
hidden in CSS. `columnFor(brief)` no longer returns `'backlog'`.

### Task 2 — Stop auto-demote (`b03fe3c`)
Columns are now fully determined by `pipeline_status` / `internal_status`.
Clearing `draft_url` no longer drops a brief back to Backlog (which was
impossible anyway after Task 1, but this commit adds an explicit invariant
doc-block so the behaviour can't silently regress).

### Task 3 — Hub drawer QA buttons (`cec4563`)
The Hub drawer never shows the Approve button — only clients approve.
Button matrix for the Hub (`showInternalNotesTab=true`):

| Column | Buttons |
| --- | --- |
| In Production + has draft | **Push to Client** |
| In Production + no draft | (nothing — paste a link first) |
| Ready for Review | **Request Revisions** (internal, pulls back to In Production, no client ping) |
| Approved | Re-run this brief (Task 6) |

Portal embeds are unchanged (still show Approve + Request Revisions).

### Task 4 — `in_production_limit` column + UI (`99160f5`)
**Migration:** `outputs/migrations/006_in_production_limit.sql`
Adds `clients.in_production_limit integer not null default 1
check (in_production_limit between 1 and 10)`.

UI: admin-only stepper (−/N/+) on the All Clients page between the
pipeline strip and the Open Board button. Saves optimistically and
reverts on error.

### Task 5 — Auto-promote (`b0e98cc`)
**Migration:** `outputs/migrations/007_auto_promote_backlog.sql`
Adds `public.auto_promote_backlog(p_client_id uuid)` plus two triggers:

- **`briefs_auto_promote`** — `AFTER UPDATE OR DELETE` on `briefs`. Fires
  whenever a brief could be leaving In Production.
- **`clients_limit_auto_promote`** — `AFTER UPDATE OF in_production_limit`
  on `clients`. Fires when an admin raises the cap.

The function counts briefs with `pipeline_status IN
('in_production','qa_review')` for the client, then promotes
`limit − count` backlog briefs, oldest first (`sort_order NULLS LAST,
created_at`). `client_review` briefs deliberately do not count toward
the cap — they're out of the studio's control.

Test scenarios (A–D) are embedded in the migration file as comments.

### Task 6 — Re-run approved brief (`ce74431`)
Clicking an approved card already opened the Hub drawer. This commit
adds a **Re-run this brief** button inside the drawer (Hub-only, only
when `pipeline_status='approved'`). It inserts a fresh backlog brief:

- Copied: `name` (prefixed `Re-run: `), `description`, `campaign`,
  `content_type`, `sizes`, `ref_url`, `client_id`.
- Cleared: `due_date`, `assigned_to`, `draft_url`, `cover_url`,
  `comments`, `attachments`.
- New status: `pipeline_status='backlog'`, `internal_status='in_production'`.

Migration 007's auto-promote trigger handles moving the new backlog
brief into In Production when the client has capacity. The button shows
inline confirmation (`Added to Backlog ✓`) for ~2.5 s instead of a toast
(the app has no toast infra; adding one was out of scope).

## Manual steps required

**Apply the two additive migrations to the shared Supabase project:**

```bash
# In Supabase SQL editor (or psql), run in order:
outputs/migrations/006_in_production_limit.sql
outputs/migrations/007_auto_promote_backlog.sql
```

After running 006, every existing `clients` row gets
`in_production_limit=1`, preserving current behaviour (one brief in
production at a time per client).

After running 007, the triggers become live immediately. There is no
backfill needed — the function is idempotent, so the first brief
status change / limit bump per client will reconcile any existing
backlog overhang on its own.

## Build status

`npm run build` is green on the tip commit. TypeScript, linter, and
page-generation all pass. No runtime regressions observed in the
dev server during smoke-testing of:

- 3-column Hub pipeline (master + per-client)
- Push-to-client flow on a brief with a draft link
- Request Revisions pulling a Ready-for-Review brief back to In Production
- Admin stepper changing `in_production_limit` (1 ↔ 10, boundaries
  respected, optimistic save)
- Re-run button on an approved brief creating a backlog copy

## Out of scope / deferred

- **Toast infrastructure.** Task 6 asked for a toast; the app has none,
  so the button uses inline confirmation instead. A toast primitive can
  land in a separate polish pass.
- **Approved-drawer read-only enforcement.** The drawer is currently
  editable even for approved briefs. Task 6 only specified the Re-run
  action; locking individual fields for approved briefs would be a
  separate change.
- **No Hub UI for auto-promote.** Per spec, the trigger runs silently.
  If the studio wants visibility into auto-promoted briefs, that's a
  dashboard story for later.
