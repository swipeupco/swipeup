# SwipeUp Hub

SwipeUp's internal control centre — where every client board, brief, and designer lives. Dark-first Next.js 16 app with Supabase as the shared data layer.

- Live: [hub.swipeupco.com](https://hub.swipeupco.com)
- Client-facing counterpart: [portal.swipeupco.com](https://portal.swipeupco.com)
- Shared Supabase project: `OTRV Marketing Hub`

## Stack

- Next.js 16.2 (App Router, Turbopack)
- React 19
- Tailwind CSS v4 with a tokenised dark-first theme (`app/globals.css`)
- Supabase (Auth + Postgres + Storage + Realtime) via `@supabase/ssr`
- `next-themes` for dark/light switching, persisted to `profiles.theme_preference`
- `@hello-pangea/dnd` for kanban drag-and-drop

## Running locally

1. Install:
   ```bash
   npm install
   ```

2. Copy the env template and fill in values:
   ```bash
   cp .env.example .env.local
   ```
   You'll need:
   - `NEXT_PUBLIC_SUPABASE_URL` — the OTRV Marketing Hub URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — anon key for client-side Supabase calls
   - `SUPABASE_SERVICE_ROLE_KEY` — service-role key for admin API routes (impersonate, seed, invite, etc.)
   - `NEXT_PUBLIC_ROOT_DOMAIN` — (optional) defaults to `portal.swipeupco.com`
   - `FRAMEIO_WEBHOOK_SECRET` — (optional) if using Frame.io webhook integration

3. Start dev:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000).

4. Log in with a Supabase account that has a `profiles` row. Role/admin gating keys off `profiles.hub_role` (`admin` | `designer`) with `is_admin` as a legacy fallback.

## Database migrations

Migrations live in `outputs/migrations/` and are applied manually against the shared Supabase project (e.g. via the Supabase SQL editor). Each pass adds one numbered file:

- `001_task-1_profile_columns.sql` — theme_preference + notification_preferences on profiles
- `002_task-5_roles_and_team.sql` — hub_role, staff_default_assignments, RLS
- `003_task-8_notifications_resolved_at.sql` — resolved_at + partial index

All additive. No destructive operations.

## Project layout

```
app/
  (auth)/          — login + auth callback
  (hub)/           — authenticated shell (Sidebar + TopBar)
    dashboard/     — metrics + ready-to-review + unresolved notifs
    pipeline/      — Production Pipeline (top-level) + /[clientSlug]
    settings/      — Profile, Notifications, Appearance, Team
    notifications/ — Full notification history
  api/             — server-side API routes
    team/          — list / invite / upsert-role / client-assignments / seed
components/
  layout/          — Sidebar, TopBar, NotificationBell
  pipeline/        — BriefDrawer
  theme/           — ThemeProvider + ThemeSync
lib/
  pipeline/        — stages.ts, updateBriefStatus.ts
  supabase/        — client, server, admin (service-role)
proxy.ts           — Next 16's rename of middleware.ts. Auth + admin gating.
outputs/           — Task summaries, migrations, manual steps. Not shipped.
refs/              — Design references. Not shipped.
```

## Authoring conventions

- **Dark-first.** Every colour is a CSS variable token (see `app/globals.css`). Never hardcode hex/zinc classes — use `text-[var(--text)]`, `bg-[var(--surface)]`, `border-[var(--border)]`, `bg-[var(--brand)]`, etc.
- **Tokens, not Tailwind greys.** If you're reaching for `text-zinc-500`, reach for `text-[var(--text-muted)]` instead.
- **`briefs.pipeline_status`** (client-facing) vs **`briefs.internal_status`** (Hub-only). Always write both together via `updateBriefStatus()` — never one or the other directly.
- **`briefs.assigned_to`** = the internal designer tag. Client UI (Portal) must not leak this.

## Commands

```bash
npm run dev     # local dev (Turbopack)
npm run build   # production build
npm run lint    # eslint
npm start       # serve production build
```

## Deployment

Pushes to `main` deploy automatically via Vercel. Feature branches (like `hub-overhaul-pass-1`) deploy to preview URLs.

## Contributing

Work off a branch, open a PR, and include screenshots for any UI change. Don't merge without eyeballing both dark and light mode.
