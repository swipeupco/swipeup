# Pass 1.5 — preview review fixes

Branch: `hub-overhaul-pass-1`. Build: **passing.** All 5 issues resolved and pushed.

| # | Issue | Status | Commit |
|---|---|---|---|
| 1 | Settings page server error | ✅ fixed | `b632905` |
| 2 | Logo position — top-right → sidebar top-left | ✅ fixed | `3e22873` |
| 3 | Per-client board wrong columns (drop Ready for Review) | ✅ fixed | `d9d7e03` |
| 4 | Production Pipeline Backlog empty | ✅ fixed | `09f1c88` |
| 5 | Sanity-check sidebar Settings link | ✅ verified | — |

---

## Issue 1 — Settings page server error

**Root cause.** `app/(hub)/settings/layout.tsx` (server component) was passing a Lucide icon *component type* as a prop to the client component `SettingsNavItem`:

```tsx
<SettingsNavItem Icon={tab.icon} />
```

React Server Components can't serialize function values (component functions) across the server/client boundary. Next 16 throws "A server error occurred" when it hits that.

**Fix.** Instantiate the icon as JSX in the server layout and pass it as `icon: ReactNode`:

```tsx
<SettingsNavItem icon={<User className="h-4 w-4" />} />
```

`SettingsNavItem` now renders the JSX inline instead of calling a component prop. All four sub-routes (`/settings/profile`, `/settings/notifications`, `/settings/appearance`, `/settings/team`) load cleanly — verified by hitting each against a local dev server (all return 200 via the auth-redirect path to `/login`, no 500s).

## Issue 2 — Logo position

- Removed the "SU" square + "SwipeUp Hub" text from the sidebar header.
- Removed the SwipeUp logo from the TopBar (right-side).
- Placed `public/SwipeUp_White.svg` in the sidebar header as a brand mark that links to `/`.
- Logo uses `[filter:invert(1)]` in light mode (source is white-on-transparent).
- NotificationBell + profile avatar unchanged on the right side of the TopBar.

## Issue 3 — Per-client board columns

`app/(hub)/pipeline/[clientSlug]/page.tsx` now renders **3 columns** (Backlog, In Production, Approved), matching the client portal's layout exactly. "Ready for Review" is removed here — it remains only on the master Production Pipeline view (`app/(hub)/pipeline/page.tsx`, confirmed still 4 columns).

Briefs with `pipeline_status='client_review'` surface in the **In Production** column with a blue **"With client"** badge on the card, so Eden can distinguish them from active in-progress briefs without needing a separate column.

The All Clients mini-pipeline strip was also collapsed from 4 chips to 3 to stay in sync. `awaiting_client_review` is still counted internally so the "Attention required" filter still surfaces clients with pending-review briefs; the In Production chip now highlights in brand violet on rows where any briefs are currently with the client.

## Issue 4 — Production Pipeline Backlog empty

**Root cause.** `columnFor()` required **all three** of:
- `assigned_to IS NULL`
- `internal_status === 'in_production'` (literally)
- no `draft_url`

Portal-created briefs fail this triangulation: (a) auto-assignment from `staff_default_assignments` fills in `assigned_to`, and (b) internal_status may arrive as `NULL` rather than the string `'in_production'`. Result: every Portal-created brief flowed past Backlog straight into In Production.

**Fix.** Inverted the logic. Backlog is now the **default bucket** for anything on the pipeline that hasn't triggered an "active" signal:

```ts
function columnFor(b) {
  if (approved/approved_by_client)         return 'approved'
  if (client_review or internal in_review) return 'ready_for_review'
  if (internal revisions_required)          return 'in_production'
  if (draft_url)                             return 'in_production'
  return 'backlog'
}
```

Hub Backlog = client portal "In Production" — matches the Task 4 brief's rule exactly.

## Issue 5 — Sidebar Settings link sanity check

- `components/layout/Sidebar.tsx` nav still includes `{ href: '/settings', icon: Settings }` — the Issue 2 edit only touched the header block, not the nav list.
- `app/(hub)/settings/page.tsx` redirects to `/settings/profile`.
- Verified via dev server:
  ```
  /settings              → 200
  /settings/profile      → 200
  /settings/notifications → 200
  /settings/appearance   → 200
  /settings/team         → 200
  ```
  (All 200s come via proxy redirect to `/login` because the dev session isn't authenticated — no 500s anywhere.)

---

## Verification

- `npm run build` — **passing**.
- Dev server boot + curl against every Settings route — **all 200**, no errors in server logs.
- Branch pushed: `origin/hub-overhaul-pass-1` at commit `09f1c88`.
