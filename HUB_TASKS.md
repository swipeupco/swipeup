# SwipeUp Hub Tasks — Pass 1 (UI overhaul + control centre)

## ⚠️ SCOPE LOCK — READ FIRST

This pass is for the **SwipeUp Hub repo only**.

- Repo: `github.com/swipeupco/swipeup` (cloned locally as `swipeup-hub` or `swipeup`)
- Live URL: `https://hub.swipeupco.com`
- Package name in package.json: `swipeup-hub`

You are **NOT** working on:
- Repo: `github.com/swipeupco/swipeup-portal`
- Live URL: `https://portal.swipeupco.com`
- Package name in package.json: `swipeup-portal`

### Mandatory pre-flight check before ANY task:
1. Run `pwd` and confirm the path contains `swipeup-hub` or `swipeup` (NOT `swipeup-portal`)
2. Run `cat package.json | grep '"name"'` and confirm it returns `"name": "swipeup-hub"`
3. Run `git remote -v` and confirm origin points to `github.com/swipeupco/swipeup` (NOT `swipeup-portal`)
4. If ANY of those checks fail, STOP. Do not write a single line of code. Tell Eden which repo you're in and ask for confirmation before continuing.

### Cross-repo references are READ-ONLY:
Some tasks tell you to "match the Portal's design" or "reuse the Portal's BriefCard component." That means:
- You may VIEW Portal files for reference (e.g. by reading them in `/mnt/project/` if provided, or asking Eden to share specific files)
- You must NEVER edit, commit, or push to the Portal repo
- When porting a component, copy its code into the Hub repo and modify it there

### Shared Supabase project — extra care:
Both apps share the same Supabase project. Schema migrations affect BOTH apps. Before running any migration:
- Confirm the migration is genuinely needed for the Hub
- Confirm it will not break the Portal (e.g. don't drop a column the Portal still reads)
- If unsure, output the migration SQL into the task summary and ask Eden to review before applying

---

Focus: clean, consistent dark-first UI across the entire Hub. The Hub is SwipeUp's internal control centre — we manage every client board from here without ever leaving. Match the visual language of the Client Portal where it makes sense, layered with internal-only Hub controls.

Folder structure:
- HUB_TASKS.md (this file)
- refs/ (reference screenshots)
  - `current-all-clients.png` — current All Clients page (what we're replacing)
  - `current-production-pipeline.png` — current Production Pipeline (what we're replacing)
  - `current-trello-board.png` — our existing Trello board, kept for workflow reference
  - `creative-requests/pipeline-portal.png` — the Client Portal's Creative Requests board (the canonical card + column design we're matching on the Hub)
  - `inspo-01.png` — general Hub UI inspiration (look + feel reference)
  - `inspo-02.png` — general Hub UI inspiration (look + feel reference)
  - `SwipeUp_White.svg` — logo asset
- outputs/ (Claude writes finished work here)

The `inspo-*.png` files set the overall visual direction for the Hub (spacing, density, typography feel, surface treatment). Apply that aesthetic across every task in this pass — not just the ones that explicitly mention them.

The `creative-requests/pipeline-portal.png` file is the source of truth for BriefCard styling, column treatment, and board layout. Any board view rendered in the Hub (per-client board in Task 3, Production Pipeline in Task 4) must match this design exactly, with internal-only Hub overlays layered on top.

Live URLs:
- SwipeUp Hub: https://hub.swipeupco.com (this pass)
- Client Portal: https://portal.swipeupco.com (reference for design language)

Supabase project: OTRV Marketing Hub (shared with Portal)

Brand colour: #4950F8 (violet-blue)
Default theme: dark (light mode is opt-in via settings)

---

## Task 1: Global UI cleanup, dark/light theming, top bar, sidebar settings
Status: pending
App: SwipeUp Hub
Brief: The whole Hub UI is inconsistent and dated. Clean it up end to end. Establish dark mode as the default visual system, add a working light mode toggle in settings, drop the SwipeUp logo into the top right, and add a real Settings section to the sidebar matching the Client Portal pattern (minus branding).

References:
- refs/inspo-01.png, refs/inspo-02.png — overall visual direction
- refs/SwipeUp_White.svg — logo asset

Steps:
1. Audit every Hub page (Dashboard, All Clients, Production Pipeline, individual client boards, any existing settings). Document current layout, spacing, typography, component inconsistencies. Output a short audit doc to outputs/task-1-ui-audit.md before making changes.
2. Establish a dark theme as the default for the Hub. Tokens: background near-black (#0A0A0B), surface (#141416), border (#26262A), text primary white, text secondary zinc-400, accent #4950F8. Match the dark login card surface style already used in the Portal login page.
3. Build a theme system. Use a ThemeProvider (next-themes or a simple context) that writes the user's preference to profiles.theme_preference (text, default 'dark'). Persist across sessions. Light mode should be a clean white surface variant of the same token system, not a separate design.
4. Add the SwipeUp logo (refs/SwipeUp_White.svg, already in /public) to the top right of every Hub page in a slim top bar. Top bar also houses: notification bell (already there, keep position), profile avatar dropdown.
5. Add a Settings section to the sidebar matching the Client Portal sidebar pattern. Settings page tabs:
   - Profile (name, avatar upload, email read-only)
   - Notifications (toggles per event type — same schema as Portal, reads/writes notification_preferences)
   - Appearance (dark / light toggle)
   - Team (only visible to admins — see Task 5)
   No branding tab on the Hub. The Hub is staff-only, no per-client branding.
6. Standardise spacing, button styles, card styles, form inputs across the entire Hub. Pick the cleanest existing pattern (likely from the Portal) and apply it everywhere.
7. Verify every existing page still functions after the theme refactor. No broken layouts, no white-on-white text, no missing icons.

Output to: outputs/task-1-ui-cleanup-summary.md

---

## Task 2: Rebuild the All Clients page (cleaner, more intuitive)
Status: pending
App: SwipeUp Hub
Brief: The current All Clients page is too busy. Too many badges, dropdowns, and CTAs competing for attention. Strip it back. The page should let me scan all clients at a glance, see who needs attention, and jump into a client board fast.

References:
- refs/current-all-clients.png — current state, what we're replacing
- refs/inspo-01.png, refs/inspo-02.png — overall visual direction

Steps:
1. Audit the current All Clients page. List every element shown per client row.
2. Redesign the row. Suggested layout (open to refinement):
   - Left: client logo + name + brief count subtitle
   - Middle: a single horizontal mini-pipeline strip (Backlog → In Production → Ready for Review → Approved) with counts. Tappable, jumps straight to that column on the client's board.
   - Right: one primary "Open Board" button. Move Users, Branding, Team Access into a single overflow menu (three-dot icon).
3. Add a top-right "+ New Client" button matching the Portal's button style.
4. Add a search bar at the top to filter clients by name.
5. Add an "Attention required" filter chip that surfaces clients with briefs awaiting review.
6. Pipeline links from this page must open the client's board styled identically to the Client Portal experience — same card design, same column treatment. Internal-only Hub controls (designer assignment, internal notes tab, internal tags) layer on top. See Task 3 for the board itself.
7. Light/dark mode parity for every state.

Output to: outputs/task-2-all-clients-rebuild-summary.md

---

## Task 3: Per-client board view (Hub control centre, mirrors Portal exactly)
Status: pending
App: SwipeUp Hub
Brief: When I click a client's "Open Board" from All Clients, I should land on a board that looks identical to that client's portal view — same card design, same columns, same spacing. The only differences are internal-only overlays (designer tag chip, internal notes tab inside the brief drawer). No "Revisions" column on this view — that lives in the client's actual portal flow, not the Hub control centre.

References:
- refs/creative-requests/pipeline-portal.png — canonical card + column design to match exactly
- refs/inspo-01.png, refs/inspo-02.png — overall visual direction

Steps:
1. Reuse the Portal's BriefCard and column components (already canonical from Portal Pass 2 Task 2). Import or copy them into the Hub.
2. Columns on this view: Backlog, In Production, Ready for Review, Approved. No Revisions column on this Hub view.
3. Internal-only additions on each card:
   - Small staff tag chip at the bottom of the card (assigned designer's avatar + initials). Only visible in the Hub. Never sent down to client portals. See Task 6 for the tagging system.
4. Brief drawer opened from this view shows an extra "Internal Notes" tab not visible to clients.
5. From this board I can edit the brief, move it between columns, and changes sync to the client's portal in real time. This is the control centre — no need to ever leave the Hub.
6. Match all hover states, drag-and-drop interactions, empty states to the Portal exactly.

Output to: outputs/task-3-client-board-view-summary.md

---

## Task 4: Rebuild Production Pipeline (Trello-inspired internal pipeline)
Status: pending
App: SwipeUp Hub
Brief: The Production Pipeline is the Hub's master view across every client. Current UI is dated. Replace with a clean, dense board using SwipeUp's design tokens. Information density should be Trello-like (see refs/current-trello-board.png for workflow reference), but the visual style follows refs/inspo-01.png and refs/inspo-02.png.

Key behaviours:
- Briefs that are "In Production" on any client portal show up in the Hub's Backlog column (Hub backlog = client in-production).
- Hub-only stages exist after Backlog, before sending back to client.
- "In Review" is renamed to "Ready for Review" everywhere.
- "Client assignments" is removed from the top of this page (moved to Settings — see Task 5).

References:
- refs/current-production-pipeline.png — current state, what we're replacing
- refs/creative-requests/pipeline-portal.png — canonical card + column styling to match (Hub overlays layer on top)
- refs/current-trello-board.png — workflow reference (column flow + density inspiration only, not visual style)
- refs/inspo-01.png, refs/inspo-02.png — overall visual direction

Steps:
1. New columns (in order): Backlog, In Production, Ready for Review, Approved. Confirm with Eden if a "QA Review" or other internal stage is wanted before "Ready for Review" — current dashboard suggests yes.
2. Each card shows: client logo + name (top), brief title, type chip (Graphic / Video / EDM), internal designer tag chip (Task 6), comment count, attachment count.
3. Add a Trello-style search bar at the top of the board. Filters cards by title, client, or assigned designer in real time.
4. Add quick filter chips next to search: "My briefs" (assigned to me), "Unassigned", "Awaiting client review". The "My briefs" and "Client assignments" buttons in the current screenshot are removed — their functionality moves into these filters.
5. Workflow rules:
   - When a brief enters Ready for Review, an input field appears on the card for the designer to paste a draft link.
   - Once a draft link is added, a "Push to client" button appears on the card.
   - Clicking Push to client moves the brief into the client's portal review queue and fires a notification to the client (uses the Task 5 notification pipeline already shipped on Portal).
   - When the client approves on their portal, the brief auto-moves to Approved on the Hub.
   - When the client requests revisions, the brief moves back to In Production on the Hub with a visible revisions badge on the card.
6. Drag and drop between Hub columns must respect role permissions (designers can only move their own assigned briefs).
7. Match Portal card styling exactly — same border-left colour stripe, same chips, same avatar treatment. Hub overlays (designer tag, internal status badges) are additive.
8. Dark mode default, light mode parity.

Output to: outputs/task-4-production-pipeline-rebuild-summary.md

---

## Task 5: User roles + Team management (admin / designer)
Status: pending
App: SwipeUp Hub
Brief: Hub needs proper role-based access. Two roles to start: admin (full access) and designer (limited). Admins manage the team from Settings. Designers see only briefs assigned to them.

Steps:
1. Add a hub_role column to profiles: text, check constraint in ('admin', 'designer'), default 'designer'. Backfill: Eden (eden@swipeupco.com) gets 'admin'.
2. Permissions matrix:
   - admin: sees everything, can add/remove staff, can change client assignments, can move any brief, can access all settings tabs.
   - designer: sees only briefs where they are tagged as the assigned designer (Task 6), cannot access Team settings, cannot change client assignments, cannot add staff.
3. Build the Team tab inside Settings (admin-only). Lists all hub staff with name, avatar, email, role, and an "Invite teammate" button at the top. Invite flow: admin enters email + role, fires a Supabase auth invite. New user lands on a passwords-set page then gets dropped into the Hub with the assigned role.
4. Add a "Client Assignments" section inside Settings (admin-only). This is the home for the feature currently sitting at the top of the Production Pipeline. UI: per-staff table showing which clients they are auto-assigned to. When a brief is created on one of those client boards, the designer is auto-tagged on it (uses brief_assigned_users from Portal Task 4 schema, plus a new staff_default_assignments table: staff_id uuid, client_id uuid, primary key both).
5. Enforce role checks in middleware AND in RLS policies. Never trust client-side role gating alone.
6. Verify designers cannot see admin-only UI even by typing the URL.

Output to: outputs/task-5-roles-team-summary.md

---

## Task 6: Internal designer tagging on briefs
Status: pending
App: SwipeUp Hub
Brief: Every brief in the Hub can be tagged with a single designer (or multiple — confirm with Eden). The tag is internal-only — clients never see it on their portal. Tags appear as a small chip on the card and as a field in the brief drawer.

Steps:
1. Schema check. brief_assigned_users already exists from Portal Task 4. Confirm it works for staff users (staff have profiles rows too, just with role 'swipeup'). If yes, reuse. If a separation is needed (client-tagged users vs staff-tagged designers), add a new table brief_internal_assignments: brief_id uuid, staff_id uuid, primary key.
2. Add a designer chip to the bottom of every Hub BriefCard showing the assigned staff member's avatar + first name. If unassigned, show a dashed "Assign designer" pill that opens a dropdown.
3. Inside the brief drawer (Hub view only), add an "Assigned designer" field with a searchable dropdown of all hub staff.
4. Auto-assignment hook: when a brief is created on a client board that has a default assignment in staff_default_assignments (from Task 5), auto-insert into the assignment table.
5. RLS: client users (role 'client') must never be able to read internal designer assignments. Use a separate table or strict RLS on the existing one.
6. Verify on the Portal side that designer tags are not exposed in any API response or UI.

Output to: outputs/task-6-internal-tagging-summary.md

---

## Task 7: Dashboard cleanup
Status: pending
App: SwipeUp Hub
Brief: Tighten the Dashboard. Two specific changes plus a general visual polish to match the new design tokens from Task 1.

Steps:
1. "Recent client feedback" section: replace the current list with a feed of unresolved notifications for the current user. Use the same notification rows as the bell dropdown. Resolved notifications drop off automatically.
2. Remove the "Pipeline by client" widget from the dashboard. Not needed for now.
3. Apply the new design tokens (Task 1) — dark by default, consistent card styling, consistent typography.
4. Confirm the rest of the dashboard widgets (counts, quick actions) still make sense after the changes. If anything looks orphaned or redundant, flag it in the output rather than silently removing.

Output to: outputs/task-7-dashboard-cleanup-summary.md

---

## Task 8: Notification bell — auto-clear on resolve
Status: pending
App: SwipeUp Hub
Brief: The bell UI is solid as-is. One behaviour change: when a notification is marked resolved (green tick clicked), it should disappear from the dropdown list immediately rather than staying with a "read" state.

Steps:
1. Audit the current notification bell. Confirm whether marking-as-read sets read_at or a separate resolved_at column.
2. Add a resolved_at timestamptz column to notifications if not already present.
3. Wire the green tick to set resolved_at = now() on click. Optimistically remove the row from the dropdown list.
4. Update the bell query to filter out rows where resolved_at IS NOT NULL.
5. Keep a "View all" link in the dropdown footer that opens a full notifications page showing both unresolved and resolved (with a toggle), so nothing is permanently lost.
6. Test: trigger a notification, see it appear, click the green tick, confirm it disappears from the dropdown but is still visible on the full notifications page.

Output to: outputs/task-8-notifications-auto-clear-summary.md

---

# Instructions for Claude Code

Work through every task marked "Status: pending" in order (Task 1 → Task 8). For each task:
1. Read the reference files listed
2. Execute the task autonomously — no confirmation gates
3. Produce the output summary to the path specified
4. Update task status to "done" with a one-line summary
5. Move to the next task

Work fully autonomously. Do not ask for approval between tasks. Complete the full list end-to-end and tell me when finished.

## Mandatory rules for every task

Database schema verification:
Before writing any code that queries or filters by a database column, first verify the column exists by running a schema check. Never assume a column exists based on existing code patterns elsewhere. If a column doesn't exist, add it with migration SQL and backfill existing data where sensible.

Scope discipline:
- Only make changes required by the current task's brief
- If you discover a pre-existing bug while working on a task, do not fix it silently. Add a "Discovered during [task name]" section at the end of that task's output summary describing the bug.

Asset and file references:
- Before referencing any image, SVG, or static asset in code, verify the file exists in the repo's public folder AND in refs/
- If an asset is referenced in task descriptions but not present, stop and flag it

Deployment verification:
- After committing and pushing, verify the deployment is live by using curl or fetching the URL
- Do not claim a task is complete based on successful build alone

Error reporting — mandatory for every task summary:
- "What was specified" — quote the brief requirements
- "What I actually built" — be honest, flag any deviations from spec
- "Skipped or partial" — any step not completed, with reason
- "Errors during the run" — every error hit, whether recovered or not
- "Assumptions to verify" — things I decided without confirmation
- "Manual steps still required" — anything needed outside Claude Code
- "Verification output" — actual curl or fetch results confirming the live site reflects changes

After all tasks finish, append a "Pass summary" section to the last task's output file:
- Overall completion status for each task (complete / partial / failed)
- Unresolved issues across the whole pass
- Recommended next steps

---

# Overnight Autonomous Mode

After Tasks 1–8 are complete, you have an open mandate to keep working through the night. Eden is asleep. The goal is that when she wakes up, both the Hub AND the Portal are working, fully synced, and ready to go live tomorrow.

## Hard rules — non-negotiable, no exceptions

These rules exist because Eden cannot answer questions while asleep. Breaking any of them turns a productive night into a disaster:

1. **Never modify the Portal repo.** You may only work on the Hub repo. If a sync issue requires Portal changes, document them in `outputs/portal-changes-required.md` for Eden to apply manually in the morning. Do not clone or edit the Portal repo.

2. **Never run destructive database operations.** No `DROP TABLE`, no `DROP COLUMN`, no `DELETE FROM` without a `WHERE` clause, no `TRUNCATE`. Additive migrations only (new tables, new columns with defaults, new indexes, new RLS policies). Anything destructive goes into `outputs/destructive-migrations-pending-review.sql` for Eden to review.

3. **Never push directly to main.** Work on the branch you started on (likely `hub-overhaul-pass-1`). Eden will merge in the morning after review.

4. **Commit frequently and atomically.** One logical change per commit, with clear messages. If something breaks, Eden needs to be able to `git revert` cleanly.

5. **Run the build after every meaningful change.** `npm run build` must pass before committing. If it fails, fix the build before moving on. Never commit broken code.

6. **If you hit something genuinely ambiguous, stop and document it.** Add the question to `outputs/eden-questions.md` and move to the next thing on the list. Do not guess at architecture-level decisions.

7. **Never touch authentication, payments, or RLS policies on the Portal side.** The Portal is in production with real client data. Hub-only changes are fine.

8. **Stop after 6 hours of total runtime** (not wall clock, actual working time). After 6 hours, write a final summary and stop. Long unsupervised runs accumulate risk.

## Task 9: Overnight discovery + execution
Status: pending (run only after Tasks 1–8 are done)

Once the planned tasks are complete, work through this checklist in order. For each item: check current state, decide if it needs fixing/adding, do the work if it's a clear win, document it if it isn't.

### A. Sync verification (highest priority)
Hub and Portal must be in sync since they share Supabase:
- Verify every Hub schema migration from this pass has compatible behaviour on the Portal side. Read Portal source (read-only via the Portal files Eden has shared in /mnt/project/) to confirm no Portal queries break.
- Verify the brief lifecycle works end-to-end: brief created on Portal → appears in Hub backlog → designer assigned on Hub → moved to Ready for Review → draft link added → "Push to client" → appears in Portal review queue → client approves → moves to Approved on both sides.
- Verify notifications fire correctly for every cross-app event.
- Document any sync gaps in `outputs/sync-gaps.md`.

### B. Bug sweep
Walk every page of the Hub. Look for:
- Broken layouts at common viewport widths (1280px, 1440px, 1920px)
- Console errors in the browser
- Network errors in API calls
- Hydration mismatches
- Missing loading states
- Missing empty states
- Missing error states
- Buttons that don't do anything
- Dead links
- Z-index conflicts
- Theme bugs (white text on white background in light mode, etc.)

Fix the easy ones. Document the ones that need design decisions.

### C. Polish pass
- Consistent spacing across every page (check against the design tokens established in Task 1)
- Consistent button sizes and styles
- Consistent form input styles
- Consistent modal/drawer styles
- Loading skeletons that match the actual content shape
- Smooth transitions on interactive elements (200ms ease default)
- Hover states on every interactive element

### D. Performance
- Run `npm run build` and check the bundle size output. If any route is over 300KB JS, investigate.
- Check for obvious N+1 query patterns in the Supabase calls. Batch where sensible.
- Check for missing image alt text and missing image dimensions.

### E. Production readiness
- Verify all environment variables are documented in a `.env.example` file
- Verify the README accurately describes how to run the project
- Add a CHANGELOG.md entry summarising this pass
- Verify error tracking / logging is in place for runtime errors

### F. Things you noticed but weren't asked about
You will see things during this pass that should be improved but weren't on the original list. For each one:
- If it's a clear improvement with no design ambiguity (e.g. fixing a typo, adding a missing aria-label, replacing a console.log), just do it
- If it requires a judgement call (e.g. "this page should probably be split into two"), document it in `outputs/discoveries.md` with: what you noticed, why it matters, and your recommended fix. Eden will decide in the morning.

### Output for Task 9
Write a comprehensive summary to `outputs/task-9-overnight-summary.md` covering:
- Total runtime
- Number of commits made + branch name to review
- Every change made, grouped by category (sync / bugs / polish / performance / production / discoveries)
- Every question or decision needing Eden's input
- Build status (passing / failing) at end of run
- Recommended order for Eden to review the work in the morning

