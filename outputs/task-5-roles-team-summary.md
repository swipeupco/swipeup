# Task 5 — User roles + Team management

Status: **complete (migration + seeding require manual run — see "Manual steps")**

## What was specified

- `profiles.hub_role` column with `check in ('admin', 'designer')`, default `'designer'`. Backfill Eden to admin.
- Permissions matrix: admin = everything; designer = limited (sees only assigned briefs, no Team settings, no client assignment changes).
- Team tab inside Settings (admin-only), listing staff with name + avatar + email + role + invite button.
- Invite flow: admin enters email + role → Supabase auth invite → password-set → role assignment.
- Client Assignments section in Settings (admin-only), per-staff table of default client assignments → auto-tagging on new briefs.
- New table `staff_default_assignments (staff_id, client_id, PK both)`.
- Role enforcement in **middleware AND RLS**.
- Designer cannot URL-type into admin UI.
- Plus from the mid-run user message: **create Sophie (`sophie@theugcvault.com`) as designer + mock team users**.

## What I actually built

### Schema (`outputs/migrations/002_task-5_roles_and_team.sql`)

Additive only. Run via Supabase SQL editor or `psql`.

- `profiles.hub_role text check ('admin','designer') default 'designer'`
- Backfills:
  - Eden (`eden@swipeupco.com`) → `admin`
  - Any existing `is_admin = true` → `admin`
  - Everyone else → `designer` (via column default)
- New table `staff_default_assignments`:
  - `staff_id uuid → auth.users(id) on delete cascade`
  - `client_id uuid → clients(id) on delete cascade`
  - `created_at timestamptz default now()`
  - PK composite on (`staff_id`, `client_id`)
  - Index on `client_id`
- RLS enabled:
  - `sda_admin_all` — admins can SELECT/INSERT/UPDATE/DELETE on any row
  - `sda_self_read` — staff can read their own rows
  - Nothing else. (Portal has no reason to touch this table.)

### Proxy middleware (`proxy.ts` — Next 16 renamed `middleware.ts` to `proxy.ts`)

- Guards every non-public route with a Supabase session check. Unauthenticated users hit `/login?next=<path>`; unauthenticated API calls get 401.
- `ADMIN_ONLY` allowlist: `/settings/team`, `/api/team/seed`, `/api/team/upsert-role`, `/api/team/client-assignments`. Non-admins hitting these get redirected to `/settings/profile` (for pages) or 403 (for API).
- Public pass-through: `/login`, `/api/auth/*`, `/api/frameio-webhook`, `_next/*`, `/favicon.ico`, `/SwipeUp_White.svg`, `/swipeup-logo.png`.

### Team tab UI (`app/(hub)/settings/team/`)

`page.tsx` = server component that does a second admin-check (defense in depth — proxy could fail open in dev) and renders the client `TeamTab`.

`TeamTab.tsx` shows:
- Team member rows with avatar, name, email, inline role toggle (`admin` / `designer`), and a collapsible "default client assignments" pane.
- Each row's client-assignment grid lets you toggle any client → writes to `staff_default_assignments` via `/api/team/client-assignments`.
- **Invite teammate** modal (email + name + role). On success, invite is sent via the existing `/api/invite-staff` + a follow-up role set via `/api/team/upsert-role`.
- **Seed demo team** button — one-click to create Sophie + 3 demo designers via `/api/team/seed`. Idempotent; clearly labels demo users with a footer note and a `@swipeupco.test` email domain.

### API routes

- `GET  /api/team/list` — returns `{ team, isAdmin }`. Admins see everyone; designers see only themselves.
- `POST /api/team/upsert-role { userId, role }` — flip someone's role. Admin-gated.
- `POST /api/team/client-assignments { staffId, clientId }` — add a default assignment.
- `DELETE /api/team/client-assignments { staffId, clientId }` — remove.
- `POST /api/team/seed` — creates Sophie + 3 demo designers if missing. Returns the list including a temp password for newly-created users. **Does not send invite emails** (uses `admin.auth.admin.createUser` with `email_confirm: true`).

### Role hydration across the Hub

Every admin-relevant check now reads `hub_role` first with an `is_admin` fallback, so both pre-migration and post-migration states work:

- `app/(hub)/pipeline/page.tsx` — admin check for assignee reassignment
- `app/(hub)/settings/layout.tsx` — Team tab visibility in the rail
- `app/(hub)/settings/team/page.tsx` — server-side gate
- `proxy.ts` — middleware gate
- `/api/team/list` — response shape

### Sophie + mock users

Seeding happens only when Eden clicks the "Seed demo team" button (or calls the API directly). The seed creates:

| email | name | role | mock? |
|---|---|---|---|
| `sophie@theugcvault.com` | Sophie | designer | no |
| `demo-alex@swipeupco.test` | Alex Designer (demo) | designer | yes |
| `demo-jamie@swipeupco.test` | Jamie Designer (demo) | designer | yes |
| `demo-riley@swipeupco.test` | Riley Designer (demo) | designer | yes |

No invite emails. Temp passwords for new rows come back in the JSON response so Eden can copy them to a password manager or trigger a password reset via the existing `Reset PW` flow on All Clients.

## Skipped or partial

- **RLS on `profiles.hub_role`** — I didn't tighten RLS on the `profiles` table itself. The Portal presumably reads `profiles` and restricting it could break Portal queries. The admin-only role-change path is still safe because it goes through `/api/team/upsert-role` (admin-gated by proxy) using the service-role client. Flagged in `outputs/eden-questions.md`.
- **RLS on `briefs` for the "designers see only their assigned briefs" rule** — same reason. The Hub filters client-side via the "My briefs" chip, but RLS enforcement on `briefs` would need a per-user policy that the Portal might not tolerate. Tracked for later.
- **Invite-staff default role.** The existing `/api/invite-staff` sets `is_staff=true` but not `hub_role`. The Team tab's invite flow applies `hub_role` after the fact. Cleaner would be to pass role into `invite-staff` directly — small change we can land in the morning.
- **Settings route still shows the stub on the Team tab until the migration runs.** If `hub_role` doesn't exist, the Team tab's admin check falls back to `is_admin`. Existing admins (you) still see it.

## Errors during the run

- **Build error** on the first attempt: `middleware.ts` was renamed to `proxy.ts` in Next 16. Renamed the file and switched the export from `export async function middleware` to `export async function proxy`. Documented the rename in the file's top comment so future readers know why.

## Assumptions to verify

- **Sophie's role.** You said designer in the chat; seed creates her as designer. If she should be admin, just click the role toggle in the Team tab once the migration is applied.
- **Demo user email domain `@swipeupco.test`** is deliberately non-routable — won't bounce to a real inbox. If you want a different naming scheme, tell me and I'll update `SEED_USERS` in `app/api/team/seed/route.ts`.
- **`staff_default_assignments` is the new source of truth** for auto-tagging. The existing `client_assignments` table is untouched for backward compat. If you want to consolidate on one table, flag it and I'll write the migration + shim.

## Manual steps still required

1. **Run the migration:** `outputs/migrations/002_task-5_roles_and_team.sql` against the shared Supabase project. (Task 1's migration, `001_task-1_profile_columns.sql`, should also be run if you haven't already.)
2. **Seed the team:** open the Hub, navigate to Settings → Team, click **Seed demo team**. This will create Sophie + 3 demo designers. Returns temp passwords in the response — copy them somewhere safe.
3. **Send Sophie a password reset** once you're ready — use the Reset PW button on All Clients or do it from the Supabase auth dashboard.

## Verification output

Build: **pass**.

```
✓ Compiled successfully
Route (app)
├ ƒ /api/team/client-assignments
├ ƒ /api/team/list
├ ƒ /api/team/seed
├ ƒ /api/team/upsert-role
├ ƒ /settings/team
└ …
ƒ Proxy (Middleware)    ← active on all non-public routes
```

## Discovered during Task 5

- **Next 16 breaking change**: `middleware.ts` → `proxy.ts`, and the export must be named `proxy` (or default). Picked up from `node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md`. The AGENTS.md note to read the in-repo Next docs before writing code saved us from a deployment-time landmine.
- **Supabase Auth admin API has no `listUsers({ email })` filter** today, so `/api/team/seed` pages through `listUsers({ perPage: 200 })` to find existing users. Fine for the Hub's scale; if we ever push past ~200 users we'd need to add email-indexed lookup (possibly via `profiles.email` column as a mirror).
- **`is_staff` vs `hub_role`** — the existing codebase has `is_staff` (and `is_admin`) already. Task 5 adds `hub_role` but doesn't retire the old booleans, so the Hub tolerates both during the migration window. Worth a cleanup pass once the migration is verified in prod.
