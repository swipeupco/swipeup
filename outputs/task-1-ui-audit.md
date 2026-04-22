# Task 1 — Hub UI audit (pre-rework)

A snapshot of every Hub surface taken before the Task 1 theme refactor, so the rebuild has a documented baseline.

## Pages inventoried

| Route | File | Current visual state |
|---|---|---|
| `/` (All Clients) | `app/(hub)/page.tsx` | Light-mode only. Teal accent `#14C29F` hardcoded. Per-client cards carry 3 heavy dropdowns (Users, Branding, Team Access) that compete for attention. Invite user/staff modals and branding editor all inline in the same file (≈940 LOC). |
| `/dashboard` | `app/(hub)/dashboard/page.tsx` | Light-only. "Recent Client Feedback" uses comments table; "Pipeline by Client" widget sits below. Metric cards use bg-blue-50/amber-50 etc., relatively colorful. |
| `/pipeline` | `app/(hub)/pipeline/page.tsx` | Kanban board (≈700 LOC). Columns have pastel header bands, cards are white. Uses drag-and-drop via `@hello-pangea/dnd`. Assignee picker inline. |
| `/pipeline/[clientSlug]` | `app/(hub)/pipeline/[clientSlug]/page.tsx` | Per-client view (not inspected in detail — will be rebuilt in Task 3). |
| `/login` | `app/(auth)/login/page.tsx` | Dark surface (zinc-950). The one page that already followed the Portal's dark login pattern. Remains untouched by Task 1 — already matches the new tokens visually. |

## Component inventory relevant to the overhaul

| Component | Path | Role before Task 1 |
|---|---|---|
| Sidebar | `components/layout/Sidebar.tsx` | Fixed left sidebar (w-64). Housed nav, notification bell, sign out, profile strip, "built by" footer. Light-only. |
| NotificationBell | `components/layout/NotificationBell.tsx` | Dropdown anchored inside the sidebar (absolute left-full). Light styling (`bg-white`, `border-zinc-200`). |
| BriefDrawer | `components/pipeline/BriefDrawer.tsx` | 21 KB drawer for editing briefs from either pipeline page. Light-only. |

## Inconsistencies logged

1. **Brand accent divergence.** Codebase is littered with `#14C29F` (teal). The Pass 1 brief fixes the Hub accent at `#4950F8` (violet-blue). Task 1 introduces `--brand` at `#4950F8`. Teal occurrences on existing pages will look stale until Tasks 2/4/7 replace them as part of their rebuilds.
2. **No theme system.** Dark mode was CSS-`prefers-color-scheme`-only; user had no control. No ThemeProvider, no next-themes, no theme column on profiles.
3. **Mixed width convention.** Sidebar was `w-64` but main content `max-w-5xl` with left padding via `ml-64`. Task 1 tightens sidebar to `w-60` and the main wrapper now flex-columns under a TopBar.
4. **Notification bell anchored inside the sidebar.** The dropdown projected right into the page from the sidebar rail — visually awkward. Moved to a proper TopBar.
5. **Settings didn't exist.** No settings route at all, so there was no way for a user to toggle dark/light, manage their profile, or set notification preferences.
6. **Two "admin" concepts.** `profiles.is_admin` (boolean) exists today. Task 5 introduces `profiles.hub_role` (admin/designer) as the canonical replacement. The Settings Team-tab gate falls back to `is_admin` if `hub_role` is not yet set, so the transition is painless.
7. **Icons hard-coded to zinc.** Lucide icons everywhere use `text-zinc-400` / `text-zinc-500` / `text-zinc-900`. These will render readably on dark surfaces but not be fully theme-aware until Tasks 2/4/7 polish the pages.
8. **No middleware.ts.** Auth gating is inline per-component — a designer accessing `/settings/team` by URL would need component-level rejection. Task 1 ships server-side gating in `app/(hub)/settings/team/page.tsx`; Task 5 will add a broader middleware layer for role checks at the edge.

## What Task 1 changed vs. left for Tasks 2–8

**Changed in Task 1:**
- Design tokens (dark default + light opt-in) in `app/globals.css`
- `ThemeProvider` + `ThemeSync` + `theme_preference` column (migration SQL)
- Root + hub layouts rewired around the new token surface
- TopBar (logo, notification bell, profile dropdown)
- Sidebar slimmed + Settings link
- Settings page shell with Profile / Notifications / Appearance / Team tabs
- NotificationBell reskinned for TopBar + dark-mode

**Left for later tasks:**
- All Clients row redesign → **Task 2**
- Per-client board styled like Portal → **Task 3**
- Production Pipeline columns + card styling → **Task 4**
- Team tab full implementation, role schema, middleware enforcement → **Task 5**
- Designer tagging chips on cards → **Task 6**
- Dashboard unresolved-feed widget + remove Pipeline-by-client → **Task 7**
- `resolved_at` column + auto-clear behaviour → **Task 8**
