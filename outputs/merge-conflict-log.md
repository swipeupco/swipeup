# Merge `origin/main` → `hub-overhaul-pass-1` — conflict resolution log

Chose **merge** over rebase to preserve the 26 overhaul commits as a visible arc of work and avoid rewriting hashes that may already be referenced by review links.

- branch: 26 commits ahead of origin/main at merge-start
- main:   16 commits ahead of branch at merge-start
- merge-base: pre-overhaul branch point

Result: 10 conflicts resolved, 2 auto-added files from main accepted, 1 auto-deleted file from main accepted, 1 orphan file deleted, 1 file rewritten to use main's component, build passing.

---

## Rule of thumb applied

Per instructions: prefer the branch's version (overhaul work) **unless main's commit is clearly a critical bugfix**. Only one file met the "critical bugfix" bar — `NotificationBell.tsx` — where main had the `user_id` scoping + avatar-URL-omission fix (the old query would have pulled ~50 MB per dropdown open once inline base64 avatars landed). Everything else went to the branch.

---

## Per-file resolutions

### 1. `app/(auth)/login/page.tsx` — **keep branch (HEAD)**

- **Branch version:** Pass 1.8 verbatim Portal port with "Team login" / "SwipeUp Creative Hub" text, live clock footer, glass-glow button, `window.location.origin`-derived reset redirect URL, `handleSubmit` name.
- **Main version:** Simpler prior port without clock, hardcoded `https://hub.swipeupco.com/api/auth/callback` URL, `handleLogin` name, teal `#14C29F` focus rings.
- **Why:** Pass 1.8 was explicitly asked-for Portal parity; reverting would undo that work. The `window.location.origin`-derived URL is also more robust — works in dev + preview deployments.

### 2. `app/(auth)/reset-password/page.tsx` (add/add) — **keep branch**

Both sides added this route with similar content. Branch version has the `FooterClock` component (Portal parity), main's doesn't. Kept branch for Portal match.

### 3. `app/(hub)/layout.tsx` — **keep branch**

- **Branch:** `<ThemeSync />` provider + `ml-60` sidebar offset (matches Pass 1 slim sidebar).
- **Main:** no ThemeSync, `ml-64`.
- **Why:** ThemeSync is load-bearing for the Pass 1 theme system; removing it strips light/dark mode entirely.

### 4. `app/(hub)/pipeline/[clientSlug]/page.tsx` — **keep branch**

- **Branch:** Pass 1.6 + 1.7 implementation that imports from `components/pipeline/PortalBoard.tsx` (shared Portal-derived BriefCard / BriefPanel / CreateBriefModal). 3-column board matching Portal, drag-from-anywhere behaviour.
- **Main:** Inline re-implementation of UserAvatar / StackedAvatars / BriefDrawer, single-file approach.
- **Why:** Branch version is the newer verbatim Portal port and reuses primitives across both pipeline routes. Main's inline version would force-duplicate the card code between `/pipeline` and `/pipeline/[slug]`.

### 5. `app/(hub)/settings/page.tsx` (add/add) — **keep branch**

- **Branch:** `redirect('/settings/profile')` — /settings is an index redirect into a tabbed structure (Profile, Notifications, Appearance, Team).
- **Main:** Renders `<NotificationSettingsSection />` at the /settings root.
- **Why:** Branch's tabbed settings is the Pass 1 design. Kept the tab structure; moved main's NotificationSettingsSection into `/settings/notifications` (see "Additional rewrite" below).

### 6. `components/briefs/TagUsersControl.tsx` (add/add) — **keep branch**

Both sides added an identical Portal-port of TagUsersControl. Branch has the Portal-parity header comment; main doesn't. Chose branch for documentation.

### 7. `components/layout/NotificationBell.tsx` — **take main (critical bugfix)**

- **Branch:** Bell scoped to no user filter; selects full notification rows including `avatar_url`. Had my Pass 1 Task 8 `resolved_at` filtering + per-row resolve button.
- **Main:** Bell scopes to `user_id = auth.uid()` and **explicitly omits** `avatar_url` from the query (~1.7 MB per row as inline base64; ~50 MB for a 30-row dropdown). Adds `actor` + `comment` joins, `event_type` handling, `resolved` boolean column, mention support.
- **Why:** The avatar-URL pull is a load-bearing perf fix that main ships with a matching schema. Branch's `resolved_at` (timestamptz) approach was a planned Pass 1 Task 8 migration that **was never applied** against prod, and main's `resolved` (boolean) column does the job already. Taking main's version wholesale keeps the Hub in sync with the real DB.
- **Follow-on:** My Pass 1 Task 8 migration `003_task-8_notifications_resolved_at.sql` is now obsolete and should not be applied.

### 8. `components/layout/Sidebar.tsx` — **keep branch**

- **Branch:** Slim sidebar with SwipeUp logo in the header; no sign-out button and no profile strip (both moved to TopBar during Pass 1 / 1.5).
- **Main:** Heavier sidebar with sign-out, profile strip, and a "Built by" footer.
- **Why:** Branch is the Pass 1 + 1.5 intentional layout — chrome was redistributed to the TopBar.

### 9. `components/layout/TopBar.tsx` (add/add) — **keep branch**

- **Branch:** Rich TopBar with profile dropdown (name, email, Profile link, Settings link, Sign out), brand-tokenised styling.
- **Main:** Minimal TopBar with just NotificationBell + a profile button routing to /settings.
- **Why:** Branch version is the Pass 1 overhaul design.

### 10. `components/pipeline/BriefDrawer.tsx` — **DELETED**

- Both sides touched this file. The branch's pipeline routes (post-merge) route through `components/pipeline/PortalBoard.tsx`'s `BriefPanel`, not `BriefDrawer`. I verified via `grep -r BriefDrawer` that the file has zero importers once the per-client page is on the branch side. Deleted to eliminate dead code + resolve the conflict.

---

## Files that auto-merged (no conflict) — for visibility

- `app/globals.css` — main's `bellPulse` / `bellIn` keyframes appended below branch's design tokens. Both survive.
- `app/api/impersonate/route.ts` — auto-merged.
- `app/api/invite-client/route.ts` — auto-merged.

## Files main added — accepted as-is

- `app/(hub)/account/notifications/page.tsx` — standalone account-level notifications settings (duplicates `/settings/notifications` functionally; kept both for backward compat since routes may be linked externally).
- `components/settings/NotificationSettingsSection.tsx` — the shared notification-prefs component. Also now consumed by `/settings/notifications`.

## Files main deleted — accepted

- `public/swipeup-logo.png` — unused post-overhaul (`SwipeUp_White.svg` is the canonical logo). Also removed the stale `/swipeup-logo.png` entry from `proxy.ts`'s public allowlist.

---

## Additional rewrites (not conflicts, but follow-on from the merge)

### `app/(hub)/settings/notifications/page.tsx` — rewritten

The branch's version wrote to `profiles.notification_preferences` (JSONB) per my Pass 1 Task 1 migration, which was never applied. Main's schema uses a dedicated `notification_preferences` table with per-event rows. Rewrote the tab page to render `<NotificationSettingsSection />` from `components/settings/` so the Hub reads/writes the production-live schema.

### `outputs/migrations/001_task-1_profile_columns.sql` — annotated obsolete

Added a POST-MERGE NOTE at the top of the migration flagging the `notification_preferences` JSONB column as obsolete. `theme_preference` is still valid and should be applied.

### `proxy.ts` — dropped `/swipeup-logo.png` from allowlist

File is deleted by main; no need to keep it whitelisted.

---

## Verification

- `grep -r '<<<<<<<\|=======$\|>>>>>>>' app components lib` → clean.
- `npm run build` → **passing**. All expected routes present including `/account/notifications`, `/notifications`, `/settings/notifications`, `/reset-password`.

## What wasn't touched and should be verified manually

- **Brief @-mention composer in `BriefDrawer.tsx`** — main added mention support to BriefDrawer. Since BriefDrawer is now deleted, the `@mention` flow only lives inside `PortalBoard.tsx::BriefPanel`. I verified by inspection that PortalBoard's BriefPanel **does** have the mention composer, `comment_mentions` insert, and the mention highlight renderer — the behaviour is preserved through the PortalBoard path. Worth double-checking once the preview rebuilds that mentions still work end-to-end.
- **`notification_preferences` table** — verify it exists and is populated in the shared Supabase project (main's commits imply it is, but the Pass 1 JSONB-column migration was never applied, and the older JSONB writes would have silently no-op'd if the column didn't exist).
