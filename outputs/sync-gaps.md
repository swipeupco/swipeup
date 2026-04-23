# Hub ↔ Portal sync gaps

Recorded during Task 9's sync verification pass. I don't have Portal source, so this is the list of things **Eden needs to verify on the Portal side** before we consider the pass "live".

---

## 1. `briefs.assigned_to` leak risk (Priority: high)

**Concern:** The Hub tags a brief with an internal designer via `briefs.assigned_to`. If Portal queries `briefs` with `select('*')`, the client payload will contain the designer's UUID. If the Portal ever joins `profiles` to render names, the internal tag becomes visible.

**Action:** grep the Portal for `assigned_to` and for broad `briefs` selects. Replace with column-pruned lists. Tracked in `outputs/portal-changes-required.md`.

## 2. `briefs.pipeline_status='client_review'` handling

**Hub writes** `client_review` when a designer hits **Push to client**. The Portal must:

- Surface the brief in the client's review queue (expected).
- On client approval, write `pipeline_status='approved'` + `internal_status='approved_by_client'`. Hub auto-moves to Approved column.
- On client revisions request, write `pipeline_status='in_production'` + `internal_status='revisions_required'`. Hub auto-moves back to In Production with a red badge.

**Verify**: Portal's approve/revisions actions write both fields together (ideally via the shared `updateBriefStatus` helper — if Portal doesn't have it, copy `lib/pipeline/updateBriefStatus.ts` across).

## 3. Notification `type` values

Hub's bell + full page recognise three types:
- `client_feedback`
- `revisions_required`
- `brief_approved`

**Verify**: Portal emits notifications using exactly these string values. Any new type emitted but not mapped renders as the fallback bubble on the Hub (still readable — just generic styling).

## 4. `notifications.resolved_at` handling

New column (Task 8). **Portal doesn't need to do anything** — new rows default to NULL (unresolved). But grep for `notifications` inserts on the Portal side just to make sure nothing is breaking.

## 5. `client_assignments` vs `staff_default_assignments`

Two tables now exist:
- `client_assignments` (old, single assignee per client, still populated by the Hub's old Client Assignments panel — now removed but the table is kept for backward compat).
- `staff_default_assignments` (new, many-to-many, used by Hub's Settings > Team and the auto-assignment hook).

**Verify**: Portal reads neither table directly (it shouldn't — these are Hub staff concerns).

## 6. `profiles.hub_role`

New column (Task 5). **Portal shouldn't read it**; it's a Hub-only concern. If Portal has queries like `select * from profiles`, the field will be present but unused.

## 7. Brief lifecycle end-to-end

Walk-through to verify after migrations are applied:

1. Client creates brief on Portal → Hub Production Pipeline shows it in **Backlog** column.
2. Hub designer drops Backlog → In Production → row now assigned. Client-side UI: no change.
3. Hub designer opens drawer, pastes a draft link → row moves to **Ready for Review** column.
4. Hub designer (or admin) clicks **Push to client** on the card → row stays in Ready for Review with a "With client" blue badge. Portal: brief appears in client's review queue + notification fires.
5. Client approves on Portal → Hub row auto-moves to **Approved** column.
6. Client requests revisions on Portal → Hub row moves back to **In Production** with a red **Revisions** badge.

**Needs manual walkthrough** with Eden in the morning.
