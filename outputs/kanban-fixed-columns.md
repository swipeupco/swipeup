# Kanban boards: Trello-style fixed-width columns

Branch: `kanban-fixed-columns`. Build: **passing**. Single atomic commit `8d4e6a6`.

## What changed

Both pipeline boards — master `/pipeline/page.tsx` and per-client `/pipeline/[clientSlug]/page.tsx` — swapped their CSS-grid column layout for a Trello-exact flex layout:

| Before | After |
|---|---|
| `grid grid-cols-4 gap-4` (master) | `flex gap-3 items-start overflow-x-auto pb-2` |
| `grid grid-cols-3 gap-5` (per-client) | (same as above) |
| Each column: no width lock | `flex-shrink-0 w-[272px] flex flex-col max-h-[calc(100vh-14rem)]` |
| Droppable: `p-3 space-y-3 min-h-[300px]` | `flex-1 overflow-y-auto p-3 space-y-3 min-h-[200px]` |

## Behaviour

- **Horizontal scroll** on the board container when columns don't fit the viewport.
- **Vertical scroll per column** when the card list exceeds `calc(100vh-14rem)`. Column header stays pinned (flex-col + flex-shrink-0 on the header).
- **Fixed width**: 272px locked per column — matches Trello's published column width exactly. No more squeezing on narrow windows.
- **Gap**: 12px (`gap-3`) between columns.
- **`pb-2` on the board** reserves space so the horizontal scrollbar doesn't overlap the bottom of the columns.
- **Min-height 200px** on the Droppable keeps empty columns visually balanced (instead of collapsing to the header's height).

## Scrollbar styling

Already handled by `app/globals.css`:

```css
*::-webkit-scrollbar        { width: 10px; height: 10px; }
*::-webkit-scrollbar-track  { background: transparent; }
*::-webkit-scrollbar-thumb  { background: var(--border); border-radius: 999px; }
*::-webkit-scrollbar-thumb:hover { background: var(--surface-3); }
```

Applies to the new horizontal scrollbar on the board container and the vertical scrollbars inside columns. Tokens resolve to subtle grays in both light mode (which is what these Portal-ported pages render in) and dark mode.

## Touch / mobile

Touch-action is left at the browser default (`auto`), which permits **both** pan-x on the board container **and** pan-y inside each scrollable column. Adding an explicit `touch-action: pan-x` on the board would have broken vertical column scrolling on touch devices, so deliberately omitted. No responsive breakpoints — 272px columns + horizontal scroll work on every screen size.

## Card audit at 272px

Interior math:
- Column width: **272px**
- Minus Droppable `p-3` (12px each side) → card width: **248px**
- Minus card `p-4` (16px each side) → card interior: **216px**
- Action row `flex gap-2` (8px) → each button: **104px**

Every card element fits:
- Open Brief button: `w-full` → 216px, ample.
- View Draft button: Play icon (12px) + gap-1.5 + "View Draft" text (~55px) ≈ 73px, fits in 104px.
- Approve button: CheckCircle (12px) + gap-1.5 + "Approve" text (~45px) ≈ 63px, fits in 104px.
- Request Revisions button: `w-full` → fits.
- Cover image `h-28 × w-full`: no clipping.
- Campaign badge on cover: `max-w-[130px] truncate` → contained.
- Tagged-users stacked avatars (22px each, +N indicator at max 3): fits.
- Client chip row (master pipeline): logo + truncated name, fits.

**No card design changes were needed.** The card was generous to begin with and 272px is well inside its comfortable range.

## Skeleton loading

Matched to the new layout — four 272px pulsing blocks on master, three on per-client, using the same `flex gap-3 overflow-x-auto pb-2` container so the skeleton matches the loaded state visually.

## Verification

- `npm run build` — **passing**.
- Dev server booted; `GET /pipeline` → 200, `GET /pipeline/[slug]` → 200. No server errors.

## Manual visual check in the browser

1. Open `/pipeline` on a wide viewport (>1400px) — all 4 columns visible, no scroll needed.
2. Resize window under ~1300px wide — horizontal scrollbar appears on the board, all columns remain exactly 272px.
3. Open a client with many briefs (`/pipeline/swipeup` etc.) — when a column gets tall, the Droppable scrolls internally while the column header stays fixed.
4. Drag a card across columns horizontally while the board is scrolled — drop behaviour still snaps to the target column (validated by @hello-pangea/dnd's auto-scroll sensor).
