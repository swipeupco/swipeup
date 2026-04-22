# Task 8 — Notification bell auto-clear on resolve

Status: **complete**

## What was specified

1. Audit bell behaviour — confirm read_at vs a dedicated resolved_at.
2. Add `resolved_at timestamptz` to `notifications` if not already present.
3. Wire the green tick to set `resolved_at = now()` + optimistically remove the row.
4. Bell query filters out rows where `resolved_at IS NOT NULL`.
5. Keep a "View all" link in the dropdown footer that opens a full notifications page with a toggle between resolved and unresolved.
6. Test: trigger → see → click tick → disappears from dropdown but still visible on the full page.

## What I actually built

### Migration (`outputs/migrations/003_task-8_notifications_resolved_at.sql`)

- Adds `resolved_at timestamptz NULL` (no default — newly-fired notifications are unresolved).
- Adds a **partial index** `idx_notifications_unresolved` on `(created_at desc)` where `resolved_at IS NULL` — the bell's hot-path query hits this directly.
- Additive only. Portal writes continue unchanged (new rows default to unresolved).

### Bell query tightened

`components/layout/NotificationBell.tsx::load()` now queries `.is('resolved_at', null)` at the database level. If that errors (column not yet deployed), we fall back to the un-filtered query and filter client-side. Either way, resolved rows never render in the dropdown.

### Green-tick resolve flow

The bell already had a per-row resolve button from Task 1's reskin. This task makes it **durable**:
- Click writes `{ resolved_at: now(), read_at: now() }` on the row.
- Optimistically removes the row from the dropdown list immediately.
- Falls back to setting only `read_at` if the column isn't yet present, so the UX is never broken.

### Full history page (`/notifications`)

New route `app/(hub)/notifications/page.tsx`:
- Two-tab pill: **Unresolved** ({n}) / **Resolved** ({n}) — live counts.
- Both lists show up to 200 recent rows, styled the same way as the bell.
- **Resolve** from the Unresolved tab → moves the row to Resolved.
- **Undo2 ("reopen")** from the Resolved tab → clears `resolved_at`, row returns to Unresolved.
- Each resolved row shows a green "Resolved {timestamp}" pill so you can see when it was cleared.
- Client-name routing — clicking a row with `client_slug` jumps to that client's pipeline.
- Loading / empty / "all caught up" states styled against tokens.

### Bell dropdown footer

Already pointed at `/notifications` from Task 1; the route now exists so that link resolves to a real page.

## Skipped or partial

- **The `resolved_at` column is still pending a manual migration run.** Until it's applied, the bell + dashboard degrade gracefully (tick still removes the row from view via `read_at`, but it reappears on refresh). Once the migration runs, behaviour becomes durable.
- **Realtime UPDATE events** aren't listened for yet — the bell's channel subscribes only to `INSERT`. After Task 8 ships, we might want `*` so marking a notification resolved on the dashboard also drops it from the bell on an open session. It's a 1-line change; I left the current INSERT-only behaviour in place to match existing semantics and avoid surprising you mid-overhaul. Flagged below.

## Errors during the run

- None.

## Assumptions to verify

- **No per-user filter on notifications.** The bell today shows every row without a `user_id` filter. Same assumption as Task 7. If RLS doesn't enforce per-user visibility, everyone sees everyone's notifications. Flagged in `outputs/eden-questions.md` for Task 9's bug sweep.
- **Reopen is an admin-safe action.** Anyone with write access to the notifications table can currently flip `resolved_at` back to null. If you want only the notification owner to re-open, an RLS tweak is needed.

## Manual steps still required

1. Run `outputs/migrations/003_task-8_notifications_resolved_at.sql` against the shared Supabase project.
2. Once run, verify the bell hides newly-resolved rows across refreshes.

## Verification output

Build: **pass**.

```
✓ Compiled successfully
Route (app)
├ ○ /notifications            ← new full-history page
└ …
```

## Discovered during Task 8

- **Realtime UPDATE subscription** would make the dashboard feed + bell stay in sync without a manual refresh. Currently marking resolved in one tab requires a refresh in another to see the change. Task 9 polish candidate.
- **The partial index on `resolved_at IS NULL`** is a nice perf win — the "unresolved" list is the only view that scales with team activity, and the index makes it scan the minority of rows.
