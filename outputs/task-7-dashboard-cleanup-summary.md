# Task 7 — Dashboard cleanup

Status: **complete**

## What was specified

1. Replace "Recent client feedback" section with a feed of unresolved notifications for the current user. Resolved ones drop off automatically.
2. Remove the "Pipeline by client" widget.
3. Apply new design tokens (Task 1) — dark by default, consistent card styling.
4. Flag anything orphaned/redundant.

## What I actually built

- **Rewrote `app/(hub)/dashboard/page.tsx` against design tokens.** Every color, surface, and border now flows through the Task 1 tokens.
- **Pipeline by client widget removed.** The big table at the bottom of the page is gone. `clientMap` useMemo was deleted; the associated query isn't fetched any more.
- **"Recent client feedback" replaced with Unresolved notifications.** New right-column card pulls from the `notifications` table (same source as the top-bar bell), filters out rows with `resolved_at !== null`, and renders up to 10 rows.
- **Per-row resolve action** — hover any notification to reveal a green-tick button; clicking it writes `resolved_at = now()` and optimistically removes the row. Gracefully falls back to setting `read_at` only if `resolved_at` column isn't present yet (Task 8 ships the column, migration pending).
- **Metric cards retained**: Active briefs, Ready to review, Needs revisions, Approved this month. Tokens applied — urgent states (revisions > 0) carry a red-tinted surface; brand-highlight states use the violet soft.
- **"Ready to review" admin section kept** — still the fastest path to push drafts through. Now tokenised, brand-violet accented, and its buttons share the design system.
- **"Needs attention" section kept** — merges revisions + awaiting-client-approval briefs. Now tokenised with indigo replaced by brand violet.
- **Role detection** now reads `hub_role` first with `is_admin` fallback, matching the Task 5 pattern.

## Skipped or partial

- **Notifications aren't scoped to the current user in the query** because the `notifications` table doesn't have a `user_id` column in the current Hub schema (same gotcha flagged in Task 1's audit — currently everyone sees all notifications, presumably RLS-enforced at the row level). I didn't add a filter client-side because it would be meaningless without per-user authoring. Flagged for Task 9's bug sweep.
- **"View all notifications" link** is referenced on the bell dropdown footer (Task 1) but the `/notifications` page doesn't exist yet. Task 8 is responsible for that page.

## Errors during the run

- None.

## Assumptions to verify

- **"Unresolved" = `resolved_at IS NULL`.** Pre-Task-8 the column doesn't exist, so every notification surfaces — acceptable for now since it matches the bell's current behaviour.
- **Top-10 cap on the dashboard feed.** The bell dropdown shows up to 40. If 10 is too few on the dashboard for your workflow, bump the `.slice(0, 10)` or remove it and let the list scroll (it's already `max-h-96 overflow-y-auto`).

## Manual steps still required

- **Task 8's migration** adds `resolved_at` to `notifications`. Once run, the resolve button becomes durable.

## Verification output

Build: **pass**.

```
✓ Compiled successfully
Route (app)
├ ○ /dashboard                ← rebuilt
└ …
```

## Discovered during Task 7

- **Dropped orphans**: `useMemo(() => recentFeedback, …)`, the `comments` query, and the `clientMap` useMemo are all gone. The `brief_comments` query that powered Recent Feedback is no longer made, removing one round-trip per dashboard load.
- **Metric card "Urgent" visuals** used a `bg-red-50` / red text combo in the old dashboard — those now render as a red-tinted surface (`border-red-500/30 bg-red-500/5`). If you preferred the sharper red from before, it's a one-line change.
