# Task 2 — Rebuild the All Clients page

Status: **complete**

## What was specified

- Strip back the current "busy" row UI.
- New row layout: logo + name (left) · mini-pipeline strip (middle) · single "Open Board" button + overflow menu (right).
- Top-right "+ New Client" button.
- Search bar filters by name.
- "Attention required" filter chip surfaces clients with briefs awaiting review.
- Light/dark parity.

## What I actually built

- **Single row per client** with three clean zones:
  - **Left zone (w-56):** client logo square + name + brief count (`N briefs`).
  - **Middle zone:** mini pipeline strip of four tappable stage chips — Backlog, In Prod, Review, Approved. Each shows the count; the "Review" chip highlights in brand violet when `ready_for_review > 0`. Clicking any chip routes to `/pipeline/{slug}?col={stage}` so Task 3's per-client board can deep-link to the column.
  - **Right zone:** `Open board` primary button (filled brand violet) + `MoreHorizontal` overflow button. The overflow menu houses **Portal users**, **Branding**, **Team access**, and **Open portal** (external link).
- **Header:** title + subtitle + top-right "+ New Client" button (brand-styled).
- **Search + filters:** `Search clients…` text input with a `Search` icon, plus an **Attention required** chip that toggles a client-count filter (clients with `ready_for_review > 0`). The chip shows a live count badge.
- **Empty state:** styled dashed-border card when no clients match.
- **Panels:** Users / Branding / Team Access expand below the row (border-t separator, `--surface-2` fill). Each panel has an inline close button + relevant CTAs.
- **Modals retained:**
  - `NewClientModal` — 3-step details → invite → done flow. Now defaults accent to `#4950F8`.
  - `InviteUserModal` — client portal user invite.
  - `InviteStaffModal` — SwipeUp editor invite. Email validation, done confirmation.
- **Shared primitives:** extracted `ModalShell`, `FormInput`, `PrimaryButton`, `FeatureToggle`, `CopyButton` for DRY modal styling.
- **Fully themed:** every color goes through `var(--brand)`, `var(--surface)`, `var(--text)` etc. Light and dark both work from the same source.

## Pipeline stage mapping (important)

The Hub-side pipeline strip aggregates `briefs.pipeline_status` values:
- `backlog` → Backlog
- `in_production` + `qa_review` → In Production (combined, since the Hub no longer surfaces QA Review separately per Task 4)
- `client_review` → Ready for Review
- `approved` → Approved

This matches the new column set the Production Pipeline rebuild (Task 4) will land — no schema migration needed. If `qa_review` stays as a Hub-only internal stage after Task 4's "confirm with Eden on QA Review" question resolves, this aggregation still does the right thing.

## Skipped or partial

- **Users panel doesn't re-fetch on invite completion inside the same row.** When you invite a user then close/reopen the panel, the cached list is invalidated and re-fetched — that covers the common case. Not a regression (the old page had the same behaviour), but worth knowing.
- **No inline "client is archived" state.** The `clients` table has no archived column today and Eden hasn't asked for one. Not adding speculatively.

## Errors during the run

- None.

## Assumptions to verify

- **Pipeline chip click target** routes to `/pipeline/{slug}?col={stage}`. Task 3 should honor `?col=` to auto-scroll/highlight the matching column when the per-client board renders.
- **"Attention required"** = clients with `ready_for_review > 0` (i.e. at least one brief sitting in `client_review`). Matches the brief's "briefs awaiting review".
- **Combined `in_production + qa_review`** in the middle strip treats QA Review as a sub-stage of In Production for the All Clients glance view. Tasks 4's decision on whether QA Review stays internal-only won't affect this.

## Manual steps still required

- None — Task 2 ships pure UI changes with no schema impact.

## Verification output

Build: **pass**.

```
▲ Next.js 16.2.3 (Turbopack)
✓ Compiled successfully
Route (app)
┌ ○ /                         ← rebuilt All Clients
├ ○ /dashboard
├ ○ /pipeline
├ ƒ /pipeline/[clientSlug]
├ ƒ /settings
└ ƒ /settings/*
```

## Discovered during Task 2

- The `clients` table has `has_shopify`, `has_vans`, `products_label` columns powering Portal features. Those aren't relevant to the Hub overview but they appear in the `NewClientModal` feature toggles — preserved as-is.
- The existing user-avatar fallback throughout uses `(user.name ?? user.email ?? '?').slice(0, 1).toUpperCase()`. Deeply defensive — kept. Worth noting the Portal probably has a nicer `Avatar` component we could port during Task 9 polish.
