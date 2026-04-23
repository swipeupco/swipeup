# Portal changes required — for Eden to apply manually

Claude cannot touch the Portal repo (scope lock). Any Portal-side change discovered while working on the Hub is logged here.

---

## 1. Audit `briefs.assigned_to` exposure (from Task 6)

**Priority:** High (leaks an internal staff tag to clients)

**What to check:** grep the Portal repo for `assigned_to` in any query against `briefs` and in any UI that renders a brief. If the field is:
- Selected with `select *` on `briefs` → the field arrives in the client payload even if unused.
- Rendered anywhere → the internal designer tag is visible to clients.

**Recommended fix path:**
- Change every Portal `select` on `briefs` to an **explicit column list** that omits `assigned_to`.
- Optionally add a view like `briefs_client_safe` that strips internal fields and point Portal queries at it instead.

**Tighter belt-and-braces option:** add an RLS policy on `briefs` that hides `assigned_to` from non-staff users. Possible via column-level permissions in Postgres, but more work than `SELECT` column pruning and risks Portal breakage if something else on the Portal reads it today.

---

## 2. Verify resolved_at column (when Task 8 ships)

**Priority:** Medium

Task 8 will add a `resolved_at` column to `notifications`. If the Portal writes notifications (e.g. when a client approves, the Portal triggers a row), the new column should default to NULL and the write path doesn't need to change. But grep the Portal for `notifications.insert` and confirm no code is surprised by an extra column.

---

## 3. Notification types extension (when Task 8 ships)

If Task 8 ends up adding new notification types (e.g. `draft_ready` for Hub-to-Portal sync), the Portal's `TYPE_CONFIG` map will need the new key, otherwise those notifications render as the fallback bubble.
