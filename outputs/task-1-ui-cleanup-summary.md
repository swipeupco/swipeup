# Task 1 — Global UI cleanup, theming, top bar, sidebar settings

Status: **complete (with documented follow-ons in Tasks 2, 4, 7)**

## What was specified

> The whole Hub UI is inconsistent and dated. Clean it up end to end. Establish dark mode as the default visual system, add a working light mode toggle in settings, drop the SwipeUp logo into the top right, and add a real Settings section to the sidebar matching the Client Portal pattern (minus branding).

Token targets: bg `#0A0A0B`, surface `#141416`, border `#26262A`, accent `#4950F8`.

Settings tabs required: Profile, Notifications, Appearance, Team (admin-only).

## What I actually built

**Design tokens** — `app/globals.css` now exports a semantic token set: `--brand`, `--brand-hover`, `--brand-soft`, `--bg`, `--surface`, `--surface-2`, `--surface-3`, `--border`, `--border-muted`, `--text`, `--text-muted`, `--text-dim`, plus status colors (danger / success / warning / info). Dark tokens are applied whenever `<html class="dark">`; light tokens otherwise.

**Theme system** —
- `next-themes` installed and configured (dark default, system detection off, transition disabled to stop FOUC).
- `components/theme/ThemeProvider.tsx` wraps the app at the root.
- `components/theme/ThemeSync.tsx` bridges the client-side theme state with `profiles.theme_preference` — reads on mount, writes on change. Silently no-ops if the column isn't yet deployed.

**Migration** — `outputs/migrations/001_task-1_profile_columns.sql` adds `theme_preference text check in ('dark','light') default 'dark'` and `notification_preferences jsonb` with sensible defaults. Both columns are additive and don't affect the Portal.

**TopBar** — new `components/layout/TopBar.tsx`, 14px tall, right-aligned:
- SwipeUp logo (inverts in light mode via `[filter:invert(1)]` since the source SVG is white).
- NotificationBell (relocated from sidebar).
- Profile avatar with dropdown (name, email, links to /settings/profile, /settings/appearance, and Sign out).

**Sidebar** — `components/layout/Sidebar.tsx` rewritten. Dropped to `w-60`, now token-driven. Nav: Dashboard, All Clients, Production Pipeline, **Settings**. Footer simplified. Notifications + profile strip moved to TopBar.

**Settings** — new `app/(hub)/settings/` route group:
- `layout.tsx`: shared tab rail on the left, body on the right. Tab gating is **server-side** — the Team tab only renders for admins (checks `hub_role === 'admin'` with fallback to `is_admin`).
- `/settings/profile` — name + avatar upload to `client-assets/staff/{userId}/*`, email read-only.
- `/settings/notifications` — 4 toggle rows (client feedback / revisions required / brief approved / brief created), persisted to `profiles.notification_preferences`.
- `/settings/appearance` — 2-option dark/light card picker using `next-themes`.
- `/settings/team` — admin-only stub; full implementation in Task 5.

**NotificationBell** — reskinned to match dark tokens; anchored right-aligned under the TopBar instead of left-projecting out of the sidebar; added a per-row "mark resolved" (green tick) button that filters the row out immediately and tries to write `resolved_at` (silently degrades if the column isn't present — Task 8 ships that column). Footer link to `/notifications` for full history.

## Skipped or partial

- **Existing pages still carry hardcoded `bg-white` / `text-zinc-900`.** The All Clients, Dashboard, and Pipeline pages will look like bright-white cards floating on a dark canvas until Tasks 2 (All Clients), 4 (Pipeline), and 7 (Dashboard) rebuild them. Text remains readable everywhere because the `bg-white` cards still have `text-zinc-900` children — but it's cosmetically ugly in dark mode. Flagged intentionally rather than hacked around.
- **Logo in light mode is filter-inverted**, not a separate light asset. Acceptable for SVG; if you want a proper black-logo file, drop it in `/public/SwipeUp_Black.svg` and I'll wire a `dark:hidden` / `hidden dark:block` pair.
- **The `/notifications` full-history page footer link** resolves to a route that doesn't exist yet — will 404. That page is Task 8's scope.

## Errors during the run

- One false start: initially rendered two `<Image>` elements with `dark:hidden` / `opacity-0 dark:block` for the logo — the opacity-0 variant would have hydrated invisible in SSR light. Simplified to a single `<Image>` with `[filter:invert(1)]` that's removed in dark mode.

## Assumptions to verify

- **Brand color = `#4950F8`**. The brief specifies this. Recent commits (`5d70ac8`, `09fe86e`) show teal `#14C29F` was in active use. Task 1 uses `#4950F8`; teal elsewhere will be phased out during Tasks 2/4/7.
- **`profiles` column names**. Used `theme_preference` (text) and `notification_preferences` (jsonb). If either differs from the Portal's naming convention, adjust the migration before running.
- **Settings server-gate falls back to `is_admin`** when `hub_role` is missing, so Task 1 doesn't hard-depend on Task 5's migration order. Once Task 5 runs, the fallback stops being exercised but remains safe.
- **Notification bell `/notifications` link** assumes Task 8 will create that route. If Task 8 ends up taking a different approach, update the link target in `components/layout/NotificationBell.tsx` footer.

## Manual steps still required

1. **Apply the migration** in `outputs/migrations/001_task-1_profile_columns.sql` against the shared Supabase project. It's additive and safe, but I didn't run it automatically because the Supabase project is shared with the Portal (per the Hub-Tasks scope lock).
2. **Once applied**, confirm a logged-in user can toggle Appearance and see the preference persist after a refresh.
3. **If you want to force everyone into dark at first login**, the default is already `'dark'` via the column default.

## Verification output

Build: **pass** (see below). Dev server not started autonomously because this is an overnight run without a browser to verify visuals; pages were validated via type-check + build only.

```
▲ Next.js 16.2.3 (Turbopack)
✓ Compiled successfully in 1919ms
  Running TypeScript ...
  Finished TypeScript in 1643ms ...
✓ Generating static pages using 11 workers (13/13) in 151ms
Route (app)
┌ ○ /
├ ○ /dashboard
├ ○ /pipeline
├ ƒ /settings
├ ƒ /settings/appearance
├ ƒ /settings/notifications
├ ƒ /settings/profile
└ ƒ /settings/team
```

## Discovered during Task 1

- `components/layout/NotificationBell.tsx` queries the `notifications` table **without a `user_id` filter**. Either RLS enforces per-user scoping or every staff member sees every notification. Flagged for Task 9's bug sweep.
- Several Hub API routes (`/api/impersonate`, `/api/invite-client`, etc.) were refactored pre-Task-1 to use a new `lib/supabase/admin.ts::createAdminClient()` helper but the file hadn't been committed. Preserved and committed as `Refactor API routes to use shared createAdminClient helper` before layering Task 1 work.
- Dashboard + Pipeline + BriefDrawer had substantial uncommitted refactors from earlier in the day. Preserved in a `Pre-Task-1 refactors` commit so no work was lost.
