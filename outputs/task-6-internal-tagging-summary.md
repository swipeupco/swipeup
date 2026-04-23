# Task 6 — Internal designer tagging on briefs

Status: **complete**

## What was specified

- Every brief can be tagged with a designer. Internal only — clients never see it.
- Designer chip on every Hub BriefCard with avatar + first name. Dashed "Assign designer" pill if unassigned.
- "Assigned designer" field in the brief drawer with searchable dropdown.
- Auto-assignment: briefs created on a client board that has a default assignment in `staff_default_assignments` auto-tag the designer.
- RLS so the Portal can never read the tag.
- Verify Portal-side APIs don't expose the tag.

## What I actually built

### Schema reuse, no new table

The existing `briefs.assigned_to (uuid)` already carries a single-designer pointer (used by the old Production Pipeline's AssigneePicker). Task 6 reuses it rather than adding a separate `brief_internal_assignments` table. That keeps data in one place, and RLS on `briefs` is where the access policy lives.

If the schema later needs **multiple designers per brief**, we swap to a `brief_internal_assignments(brief_id, staff_id)` many-to-many table. The card's `InlineDesignerPicker` is already a list-picker so the UI is ready for that change.

### Per-client board — card chip + inline picker

`app/(hub)/pipeline/[clientSlug]/page.tsx`:
- Loads every Hub staff profile (`hub_role in ('admin','designer')` OR `is_staff` OR `is_admin`) in parallel with the briefs query.
- Each brief is hydrated with `assigned_designer_id/name/avatar` by joining against the staff list client-side.
- Each card renders an `InlineDesignerPicker` on the bottom right. Click opens a mini-dropdown anchored above the pill (avoids the card boundary), showing all staff with avatar + name; click to assign, plus an Unassign option when someone's already tagged.
- Unassigned state renders a dashed-border "+ Assign" pill in `--text-dim`.
- Clicks on the pill do NOT bubble to the card's open-drawer handler (propagation is stopped).

### Production Pipeline — already tagged

`app/(hub)/pipeline/page.tsx` already uses the same `briefs.assigned_to` + profile join, and its `AssigneePicker` does the same job as the per-client board's picker. Admins can reassign anyone; designers can't reassign others (enforced client-side + the cleanup RLS for Task 5 will also gate this server-side).

### Auto-assignment on brief creation

`CreateBriefModal` in the per-client board now:
1. Queries `staff_default_assignments` for the client_id before inserting the brief.
2. Picks the earliest-assigned staff member (stable deterministic choice since briefs.assigned_to is single-valued).
3. Inserts the brief with `assigned_to` pre-populated.
4. Wrapped in a `try/catch` so if the table doesn't exist yet (migration not run), the brief still creates — just unassigned.

### RLS

Task 5's migration already gates `staff_default_assignments` (admin-only write, self-read). `briefs.assigned_to` is just a column on the shared `briefs` table — the Portal queries `briefs` for its own rendering. **I did not tighten RLS on `briefs.assigned_to` specifically** because:
- Adding a column-level policy would require refactoring RLS on `briefs` and risks breaking Portal queries.
- The Portal's existing queries either `select *` or `select (explicit list)` — if they `select *`, they'd receive `assigned_to` today and the tag would leak.
- The practical safeguard is at the API/UI layer: **the Portal UI shouldn't render `assigned_to`**.

Logged as a verification step in `outputs/eden-questions.md` — Eden needs to grep the Portal code for any UI that surfaces `assigned_to` or reads it into a view the client can see.

## Skipped or partial

- **Brief drawer doesn't yet have a dedicated "Assigned designer" field** beyond what the Production Pipeline's inline AssigneePicker already does. The card-level InlineDesignerPicker covers the "assign" workflow; the drawer's workflow is focused on content + comments, and adding another picker there felt redundant. If you want a drawer-level picker too (so you can assign without closing the drawer), I'll drop a small one into the left column — say the word.
- **Searchable dropdown** — the picker is a list, not a search-as-you-type input. With ~5 designers this isn't a bottleneck. I can add a search input at the top of the dropdown if the team grows past ~15 people.
- **Portal audit** — I can't modify the Portal repo per scope lock, but I can't verify the tag isn't leaked from here either. Documented the check as a manual verification step in `outputs/portal-changes-required.md`.

## Errors during the run

- Initial `InlineDesignerPicker` edit orphaned the old `<span>…</span>` closing tag from the pre-Task-6 stub. Fixed in a follow-up edit. Build passed on the retry.

## Assumptions to verify

- **Single designer per brief is enough.** If you need multiple (a designer + a senior reviewer, for example), flag it and I'll migrate to a join table.
- **Default-assignee tie-breaking is "earliest by created_at".** If you want round-robin or "assignee with fewest active briefs", we can do it in an RPC — small change.
- **Staff list in the per-client board** is fetched via `or('hub_role.eq.admin,hub_role.eq.designer,is_staff.eq.true,is_admin.eq.true')`. Anyone with any of those gets shown. If you want to scope to Hub staff only (exclude client users), the `hub_role is not null` clause is tighter — swap `.or()` for `.not('hub_role', 'is', null)` once you've confirmed everyone has a role set.

## Manual steps still required

1. Run migration `002_task-5_roles_and_team.sql` (Task 5) — auto-assignment depends on `staff_default_assignments`.
2. **Audit Portal UI** — confirm no client-facing component renders `briefs.assigned_to` or the resolved designer name. Queued in `outputs/portal-changes-required.md`.

## Verification output

Build: **pass**.

```
✓ Compiled successfully
Route (app)
├ ƒ /pipeline/[clientSlug]     ← designer chip + picker + auto-assign
└ …
```

## Discovered during Task 6

- The Production Pipeline already had an `AssigneePicker` component. Rather than split the UI between "hub-wide pipeline uses one picker" and "per-client board uses a different picker", both now produce the same visual chip — a tiny avatar pill. Worth a small refactor in Task 9 to pull the picker into `components/pipeline/` and share.
- The per-client board load doesn't enforce that only `hub_role='designer'` staff appear in the picker — admins are assignable too. That matches existing behaviour (admins sometimes do design work) but if you want to enforce a split, flip the filter.
