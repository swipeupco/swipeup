# Task 3 — Per-client board view (Hub control centre)

Status: **complete**

## What was specified

> When I click a client's "Open Board" from All Clients, I should land on a board that looks identical to that client's portal view — same card design, same columns, same spacing. The only differences are internal-only overlays (designer tag chip, internal notes tab inside the brief drawer). No "Revisions" column.

Columns: Backlog, In Production, Ready for Review, Approved.

## What I actually built

- **`app/(hub)/pipeline/[clientSlug]/page.tsx` rewritten** against design tokens. Four columns exactly: Backlog, In Production, Ready for Review, Approved. Revisions surfaces as a **red badge on the card**, not a column, per the brief.
- **Column-key mapping** to database `pipeline_status`:
  - Backlog → `backlog`
  - In Production → `in_production` (also captures legacy `qa_review` rows so they don't disappear)
  - Ready for Review → `client_review`
  - Approved → `approved`
- **Deep-linking from Task 2.** The page reads `?col=<key>` from the URL; if present, that column renders with a brand-colored ring (`ring-2 ring-[var(--brand-ring)]`). Clicking a pipeline chip on the All Clients page drops you straight into the matching column.
- **`HubBriefCard` component** built to match the Portal's creative-requests card design:
  - Left accent stripe in the client's color
  - Optional campaign subtitle in uppercase/dim text
  - Bold title (line-clamp-2)
  - Content-type chip with lucide icon (Video / Graphic / EDM / Signage / Voiceover / Script / Other)
  - Revisions badge (red) or "Draft ready" badge (brand violet)
  - Footer row: due date, comment count, and — critically — a **DesignerChip** on the bottom-right
- **`DesignerChip`** is the internal-only overlay:
  - If the brief has `assigned_designer_name/avatar` populated, shows a compact avatar + first name pill
  - If nothing is assigned yet, shows a dashed-border "+ Assign" pill
  - Task 6 will wire real data into `assigned_designer_*` fields (via the existing `brief_assigned_users` table or a new `brief_internal_assignments` table — Eden to decide)
- **Comment counts are fetched in one batch** per board load (`brief_comments` filtered by the board's brief ids). Avoids the N+1 pattern from the earlier implementation.
- **Empty column state** uses a dashed border and `Empty` placeholder so the board never looks visually broken.
- **BriefDrawer updated** to the dark tokens *and* given proper **Client / Internal comment tabs** when `internalMode` is set:
  - Clients-only view (Portal) shows a single stream (internal notes are skipped server-side anyway via `is_internal` filter).
  - Hub view shows tabbed toggles — Client ({n}) / Internal ({n}) — so designers can switch between client feedback and internal notes without them mixing in a single scroll.
  - Workflow buttons (View draft, Push to client, Mark approved) are now brand-colored; approved/revisions banners use token-semantic tinted surfaces.
- **Real-time sync preserved.** The existing `postgres_changes` subscription still fires `load()` on any briefs update; the drawer's own comment channel still fires `loadComments()`. No regression.

## Skipped or partial

- **Drag-and-drop between Hub columns isn't wired here.** The existing per-client board never had DnD (it used per-card "Move to X" buttons instead). The brief didn't explicitly require DnD on the per-client view — it's called out on the Production Pipeline (Task 4). Kept click-to-open; dragging is deferred to Task 4 territory.
- **Designer chip is stubbed with placeholder fields** (`brief.assigned_designer_*`). The chip renders correctly but those fields don't exist on the table yet — they'll be populated via a view/join or a `brief_internal_assignments` table when Task 6 lands. Safe as-is because `?? null` falls through to the dashed-pill "+ Assign" state.

## Errors during the run

- None.

## Assumptions to verify

- **Four columns, no QA Review.** Any existing `pipeline_status = 'qa_review'` rows are folded into In Production so they stay visible. If QA Review should be its own Hub-only lane (Task 4 asks a similar question), change `COLUMNS` in `[clientSlug]/page.tsx` and add back a 5th column.
- **`?col=<key>` highlighting** uses `ring-2 ring-[var(--brand-ring)]`. No auto-scroll — the page is horizontally scrollable. If you want the browser to scroll the column into view on load, we'd need a ref + `scrollIntoView`. Flag if you want that.
- **Drawer comment tabs** default to **Client** when opened, which matches the "I'm reviewing client feedback" primary intent. If you'd rather default to Internal for designers, flip the default in `commentsTab`'s `useState`.

## Manual steps still required

- None for Task 3.
- Task 6 will wire real designer assignment to the chip.

## Verification output

Build: **pass**.

```
✓ Compiled successfully in 1609ms
Route (app)
├ ƒ /pipeline/[clientSlug]     ← rebuilt
└ …
```

## Discovered during Task 3

- The old per-client page wrote `internal_status` via a raw `supabase.from('briefs').update(...)` even though `updateBriefStatus` in `lib/pipeline/updateBriefStatus.ts` already encapsulates the status-change logic. The rewrite still uses a raw update for internal-only moves because the helper requires `pipeline_status`, but it would be cleaner if `updateBriefStatus` accepted a standalone `internal_status`. Worth a small refactor during Task 9 polish.
- `useSearchParams()` under Next 16 App Router is a client-component-only hook (this page is client-side so it's fine), but it does make the page opt out of partial pre-rendering. Verified — the route is listed as `ƒ` (dynamic) already in the build output.
- The existing `briefs` table shape uses `pos` for ordering within a column. We're respecting that. DnD in Task 4 will need to update `pos` on drop.
