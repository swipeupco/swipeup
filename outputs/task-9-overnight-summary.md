# Task 9 — Overnight discovery + execution summary

Status: **complete** (bounded pass; nothing blocking)

---

## Pass overview

Total elapsed: roughly 3 hours of active work (well under the 6-hour budget).

Commits on `hub-overhaul-pass-1` (newest first):

| Commit | Scope |
|---|---|
| `4f1314d` | Task 8 — notifications auto-clear + /notifications page |
| `20d64a9` | Task 7 — dashboard cleanup (unresolved feed, killed Pipeline-by-client) |
| `b51e7de` | Task 6 — internal designer chip + auto-assign |
| `4d78636` | Task 5 — roles, Team tab, proxy-gated admin surfaces |
| `020db68` | Task 4 — Production Pipeline rebuild |
| `82b7634` | Task 3 — per-client board mirrors Portal + internal overlays |
| `015b8f7` | Task 2 — All Clients rebuild |
| `af692ae` | Task 1 docs |
| `c2d698e` | Task 1 — dark-first tokens, top bar, Settings |
| `548e46d` | HUB_TASKS.md + refs/ + SwipeUp_White.svg |
| `4caf8b7` | Eden's pre-Task-1 page refactors preserved |
| `b69e057` | Eden's pre-Task-1 admin-client refactor preserved |

Branch is pushed to `origin/hub-overhaul-pass-1`. **Build status at end of run: passing.**

---

## Per-task completion

| Task | Status | Notes |
|---|---|---|
| 1. Global UI cleanup + theming | ✅ complete | Migration pending manual run |
| 2. Rebuild All Clients | ✅ complete | UI only, no schema |
| 3. Per-client board | ✅ complete | Reuses BriefDrawer, new HubBriefCard |
| 4. Production Pipeline | ✅ complete | 4 columns, search, 3 filter chips |
| 5. Roles + Team management | ✅ complete | Migration + seeding pending manual run |
| 6. Internal designer tagging | ✅ complete | Reuses `briefs.assigned_to` |
| 7. Dashboard cleanup | ✅ complete | Unresolved feed + removed Pipeline-by-client |
| 8. Notifications auto-clear | ✅ complete | Migration pending manual run |
| 9. Overnight discovery | ✅ complete | This doc |

---

## Changes grouped by category

### Sync
- Documented full Hub↔Portal sync requirements and walk-through in `outputs/sync-gaps.md`. Portal source isn't available to this session, so verification requires Eden.
- Documented Portal-side changes needed (assigned_to leak, notification type parity, resolved_at presence, walk-through). See `outputs/portal-changes-required.md`.

### Bugs (resolved during the pass)
- `middleware.ts` → `proxy.ts` rename for Next 16.
- Orphaned closing tags in `InlineDesignerPicker` fixed after Task 6's first edit.
- NotificationBell had an unused `resolvedColExists` state + redundant eslint-disable — cleaned up during Task 9.
- Removed the now-unused `CommentCount` interface from `[clientSlug]/page.tsx`.

### Bugs (left for attention)
- `notifications` table has no `user_id` filter in any query. Either RLS is enforcing per-user scoping server-side (then it's fine) or everyone sees every notification. Flagged in `outputs/discoveries.md` and `outputs/eden-questions.md`.
- Legacy login page (`app/(auth)/login/page.tsx`) uses `bg-zinc-950` hardcoded classes rather than tokens. It happens to render correctly in both modes because of its dark-on-dark design, but it's drifting from the token system. Low priority cleanup for the next pass.

### Polish
- Tokenised every new surface. Every card, border, text colour flows through `--brand`, `--surface`, `--text`, etc.
- Consistent spacing: `p-8 max-w-5xl` on top-level pages, `rounded-2xl border border-[var(--border)] bg-[var(--surface)]` for cards.
- Consistent transitions (200ms default via Tailwind's `transition-colors`).
- Hover states on every interactive element (chips, rows, buttons).
- Focus rings via `:focus-visible` in `globals.css`.

### Performance
- Partial index on `notifications(created_at desc) where resolved_at is null` (Task 8 migration) so the bell's hot path scans a narrow index.
- Batched comment-count query in the per-client board (previously was one-per-card risk; now a single `in ('id1','id2',…)` fetch).
- Removed the Pipeline-by-client widget and its associated `brief_comments` query from the dashboard, cutting a round-trip.
- No N+1 patterns introduced during this pass — every list page fetches list + related rows in parallel via `Promise.all`.

### Production readiness
- `.env.example` added with every env var the Hub uses.
- `README.md` rewritten with stack, run instructions, migrations, layout, conventions, commands, deployment notes.
- `CHANGELOG.md` added with a full Pass 1 entry.
- Migrations checked in to `outputs/migrations/` with clear numbered naming (`001_…`, `002_…`, `003_…`) and "additive only" promises.
- Three questions logged to `outputs/eden-questions.md` for morning review.

### Discoveries (outputs/discoveries.md)
- No `user_id` on notifications.
- BriefDrawer getting large; ripe for split.
- Two near-identical assignee pickers — small refactor candidate.
- `briefs.pos` gets stale across DnD — future fix.
- `client_assignments` vs `staff_default_assignments` drift — Eden decides which to canonicalise.
- Tailwind v4 + next-themes: legacy `dark:` prefix usage on the login page needs cleanup eventually.
- Pipeline card hover state is subtle on dark — potential tweak.
- Portal's BriefCard component wasn't accessible to me; HubBriefCard is built to match the screenshot reference.

---

## Everything Eden needs to do in the morning

**Must-do before shipping:**
1. Run `outputs/migrations/001_task-1_profile_columns.sql` (theme + notification prefs).
2. Run `outputs/migrations/002_task-5_roles_and_team.sql` (hub_role + staff_default_assignments + RLS).
3. Run `outputs/migrations/003_task-8_notifications_resolved_at.sql` (resolved_at + partial index).
4. Open the Hub, navigate to **Settings → Team**, click **Seed demo team** (creates Sophie + 3 demo designers, no invite emails sent).
5. Copy temp passwords from the API response to a password manager or trigger a reset for Sophie.

**Should-do within the next few days:**
6. Audit Portal code per `outputs/portal-changes-required.md` — the `briefs.assigned_to` leak is the main one.
7. Walk the brief lifecycle per `outputs/sync-gaps.md` §7 to confirm Hub↔Portal parity.
8. Answer the three questions in `outputs/eden-questions.md`.

**Nice-to-do eventually:**
9. Review `outputs/discoveries.md` and decide which refactors graduate to Pass 2.

---

## Suggested review order in the morning

1. **This file** (`outputs/task-9-overnight-summary.md`) — 5 minutes.
2. **`outputs/eden-questions.md`** — my ambiguous decisions, annotated.
3. **`outputs/portal-changes-required.md`** — cross-repo asks.
4. **`outputs/sync-gaps.md`** — end-to-end verification steps.
5. **Deploy a preview** of `hub-overhaul-pass-1` on Vercel and click through Dashboard → All Clients → a client board → Production Pipeline → Settings → Team → Notifications.
6. **Toggle light mode** in Settings → Appearance and verify no broken styles.
7. **Each task summary** in `outputs/task-{1..8}-*.md` as your interest takes you.

---

## Final build verification

```
▲ Next.js 16.2.3 (Turbopack)
✓ Compiled successfully
Route (app)
┌ ○ /                                         (rebuilt, Task 2)
├ ○ /dashboard                                (rebuilt, Task 7)
├ ○ /notifications                            (new, Task 8)
├ ○ /pipeline                                 (rebuilt, Task 4)
├ ƒ /pipeline/[clientSlug]                    (rebuilt, Task 3 + 6)
├ ƒ /settings                                 (new)
├ ƒ /settings/appearance                      (new, Task 1)
├ ƒ /settings/notifications                   (new, Task 1)
├ ƒ /settings/profile                         (new, Task 1)
├ ƒ /settings/team                            (new, Task 5)
├ ƒ /api/team/client-assignments              (new, Task 5)
├ ƒ /api/team/list                            (new, Task 5)
├ ƒ /api/team/seed                            (new, Task 5)
└ ƒ /api/team/upsert-role                     (new, Task 5)

ƒ Proxy (Middleware)                          (new, Task 5)
```

Build: **passing**. Lint: **clean of new issues I control**; pre-existing `any` types in legacy API routes remain (they were like that before this pass).

Good night. See you in the morning.
