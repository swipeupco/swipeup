# Pass 1.6 — port the Portal's Creative Requests UI verbatim

Branch: `hub-overhaul-pass-1`. Build: **passing.** All 6 tasks resolved and pushed.

| # | Task | Commit |
|---|---|---|
| 1 | Add `@hello-pangea/dnd` dependency | already present at `^18.0.1` (matches Portal) |
| 2 | Port per-client board | `5d6ee29` |
| 3 | Port master Production Pipeline | `beb1655` |
| 4 | Port supporting libs | (in `5d6ee29`, TagUsersControl) |
| 5 | Port globals.css / tokens | no-op — wrapper isolates light context |
| 6 | Fix sidebar logo regression | `820b022` |

---

## Approach

The Portal's `src/app/(app)/trello/page.tsx` (2,146 lines) was the canonical reference. Rather than inline-port it into each Hub route and duplicate the card/drawer/modal code, the shared primitives live in `components/pipeline/PortalBoard.tsx`:

- `UserAvatar`, `StackedAvatars`, `initialsOf` helpers (verbatim)
- `CONTENT_TYPES`, `SIZES` constants (verbatim)
- `Brief`, `Comment` types + Hub-only fields (`client_name/color/logo`, `assigned_designer`)
- `BriefCard` — Portal's card, optional `showClientChip` prop for the master pipeline
- `ApprovedBriefCard` — verbatim
- `BriefPanel` — Portal's full-page drawer, optional `showInternalNotesTab` + `hubStaff` + `onAssignDesigner` for the Hub overlays
- `CreateBriefModal` — Portal's create form minus the AI generator (Hub doesn't have `/api/ai-brief`)

Both the per-client board (`/pipeline/[clientSlug]`) and the master pipeline (`/pipeline`) consume those primitives. Each page wraps its content in `bg-[#F7F8FA] text-gray-900 min-h-[calc(100vh-3.5rem)]` so the Portal's light classNames (`bg-white`, `text-gray-*`, `border-gray-100`, etc.) render in their intended light context regardless of the Hub's outer dark theme.

## Per-client board (`/pipeline/[clientSlug]`)

- **3 columns**: Backlog, In Production, Approved — matches the Portal exactly.
- **DnD rules**: reorder within Backlog; Backlog → In Production auto-bounces an existing production brief back to Backlog (the Portal's 1-at-a-time constraint, preserved verbatim).
- **Auto-promote**: approving a brief automatically promotes the top Backlog brief into production.
- **Hub-only overlays**:
  - Sticky header with Back button + Client portal link + client logo/name.
  - BriefCard shows an **Assigned Designer chip** on the bottom row.
  - BriefCard shows a **"With client"** blue pill when `pipeline_status='client_review'`.
  - BriefPanel exposes a **Client / Internal comment tab toggle**. Internal threads render in amber (avatar, bubble, input border/bg, send button).
  - BriefPanel exposes an **Assigned designer picker** and a **draft link input** (paste a URL, blur saves it).

## Master Production Pipeline (`/pipeline`)

- **4 columns**: Backlog, In Production, Ready for Review, Approved.
- **Same BriefCard styling** as the per-client board, with `showClientChip` on so each card prepends a client logo + name row.
- **Search bar** filters by brief name, client name, assigned-designer name.
- **Filter chips**: My briefs, Unassigned, Awaiting client review — each with a live count.
- **Column membership** is driven by `columnFor()` with the Pass-1.5 Issue-4 rule: Backlog is the default bucket for any brief at `pipeline_status='in_production'` that hasn't triggered an "active" signal (draft, revisions, review, approval). Hub Backlog = Portal "In Production".
- **DnD between columns** respects role perms — designers can only move their own assigned briefs; admins can move anything.

## Supporting libs

- `components/briefs/TagUsersControl.tsx` — verbatim copy of the Portal's component.
- `active-client-context` not needed. The per-client board reads `clientSlug` from the URL params and queries the `clients` table directly. The master pipeline queries every client in one shot.

## Globals.css / Tailwind

No merge. The Portal's `globals.css` defines brand colour vars (`--brand: #14C29F`) and a global body bg (`#F7F8FA`). The Hub already has its own token system (Pass 1). Rather than fight them, each pipeline page opts out of the Hub's dark shell by wrapping its body in `bg-[#F7F8FA]`. The Portal's class names (`bg-white`, `bg-gray-50`, `text-gray-700`, `border-gray-100`, etc.) all resolve through Tailwind v4 directly.

The Portal's scrollbar tweaks + bell pulse animations aren't used on these pages; the Hub's tokens still own the outer dashboard, settings, and all-clients shells.

## Sidebar logo regression fix

The Pass-1.5 commit had already moved the SwipeUp logo to the sidebar top-left. The preview-review regression (`SU + SwipeUp HUB + green icon`) was likely caused by Next/Image's optimiser caching an SVG variant with the `filter: invert(1)` stripped. Added `unoptimized` (matching the Portal's footer pattern) so the raw SVG is served as-is and the light/dark filter hook works reliably across deploys. Also dropped the stale "SwipeUp Hub — internal" footer block for cleanliness.

---

## Verification

- `npm run build` passes.
- Per-client board uses the exact Portal card markup (covers, type chips, drag handle, badge stack, Open Brief button, View Draft + Approve actions, and Request Revisions link).
- BriefPanel drawer uses the exact Portal layout (cover banner, brand-colour hero strip, 52%-width left column with editable fields, 48%-width right column with comments + @-mention autocomplete).
- The `@hello-pangea/dnd` version is locked at `^18.0.1` in both repos so drag interactions behave identically.

## Acceptance criteria

Opening the preview deployment alongside the live Portal, the Hub's Production Pipeline cards and per-client board cards should now match the Portal's Creative Requests cards pixel-for-pixel (modulo the Hub-only designer chip + "With client" pill on the in-production card + client-logo row on master pipeline cards). The brief drawer should also match, with the added Client/Internal tab and designer picker.
