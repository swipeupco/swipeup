# Changelog

## Hub Overhaul — Pass 1 (2026-04-23)

Branch: `hub-overhaul-pass-1`

End-to-end visual + architectural overhaul of the SwipeUp Hub. Dark-first design, tokenised theme, new Settings section, rebuilt All Clients / per-client board / Production Pipeline, roles + team management, internal designer tagging, and notifications auto-clear.

### Added

- **Dark-first design token system** (`app/globals.css`). Brand violet-blue `#4950F8`, full surface/text/border token set with light opt-in.
- **`next-themes` ThemeProvider + ThemeSync** — user preference persisted to `profiles.theme_preference`.
- **TopBar** with SwipeUp logo, notification bell, and profile avatar dropdown.
- **Settings route group**: `/settings/profile`, `/settings/notifications`, `/settings/appearance`, `/settings/team` (admin-only).
- **Team tab** with inline role toggle, per-staff default client assignments, invite modal, and a "Seed demo team" button that creates Sophie + 3 demo designers.
- **Production Pipeline** rebuilt with 4 semantic columns (Backlog, In Production, Ready for Review, Approved), search bar, and filter chips (My briefs, Unassigned, Awaiting client review).
- **Per-client board** mirrors the Portal's card + column design with internal-only overlays (designer chip, Internal Notes tab in drawer).
- **Internal designer chip** on every Hub brief card, inline picker with staff dropdown, and auto-assignment on brief creation via `staff_default_assignments`.
- **Proxy middleware** (`proxy.ts`) gating admin-only routes (Team tab, `/api/team/*`).
- **Notifications page** (`/notifications`) with Unresolved / Resolved tabs and a reopen action.
- **Partial index** on `notifications(created_at desc) where resolved_at is null` — bell's hot-path query.
- **`staff_default_assignments`** table + RLS policies.
- **`hub_role`** on profiles (`admin` | `designer`) with Eden seeded as admin.
- **`theme_preference`** + **`notification_preferences`** columns on profiles.
- **`resolved_at`** column on notifications.
- **`.env.example`** + production-ready **README**.

### Changed

- **Sidebar** slimmed (w-60), rewritten against tokens, `Settings` nav entry added, notification + profile moved to TopBar.
- **NotificationBell** reskinned for TopBar anchoring, per-row resolve button, DB-level filter on `resolved_at IS NULL` with a client-side fallback.
- **All Clients** page stripped back: one clean row per client with logo + name, a tappable mini-pipeline strip, single "Open board" button, and a three-dot overflow menu for Users/Branding/Team Access. Added a search bar and an "Attention required" filter chip.
- **Dashboard** swapped Recent Client Feedback for an Unresolved Notifications feed; removed the Pipeline-by-client widget; metrics + panels tokenised.
- **BriefDrawer** reskinned for dark tokens and given Client / Internal comment tabs when `internalMode` is set.
- **Admin detection** everywhere now prefers `hub_role` with an `is_admin` fallback for backward compat.
- **API routes** (`/api/impersonate`, `/api/invite-*`, `/api/reset-password`, `/api/remove-user`, `/api/staff-access`) consolidated onto a shared `createAdminClient` helper in `lib/supabase/admin.ts`.

### Infrastructure

- **`middleware.ts` → `proxy.ts`** — Next 16 renamed the convention.
- Three additive migrations checked in to `outputs/migrations/` for manual application against the shared Supabase project.
