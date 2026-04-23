# Pipeline pages — radial brand-violet gradient background

Branch: `pipeline-gradient-bg`. Build: **passing**. Single atomic commit `1066e15`.

## The recipe

A new `.pipeline-bg` utility class in `app/globals.css`:

```css
.pipeline-bg {
  background:
    radial-gradient(ellipse 900px 600px at 0% 100%, rgba(73, 80, 248, 0.06), transparent 55%),
    #F7F8FA;
}
.dark .pipeline-bg {
  background:
    radial-gradient(ellipse 1200px 800px at 0% 100%, rgba(73, 80, 248, 0.22), transparent 55%),
    #0B1220;
}
```

- **Base colour (dark):** `#0B1220` — near-black with a touch of blue, matches the top-right fade of the login page bg.
- **Glow (dark):** brand violet `#4950F8` at 22% opacity, ellipse anchored at `0% 100%` (bottom-left), fading to transparent at 55%. Ellipse is 1200×800px so the glow tapers gracefully across wide viewports without looking stretched.
- **Base (light):** `#F7F8FA` — the existing pipeline-page off-white, unchanged.
- **Glow (light):** same recipe but 6% opacity + smaller 900×600 ellipse — barely-there brand-violet hint on the bottom-left. Enough to feel related to the dark mode without washing out the light surface.

Pure CSS — no `bg.png` dependency.

## Where it's applied

Only on the two pipeline-board pages:
- `app/(hub)/pipeline/page.tsx` — master Production Pipeline
- `app/(hub)/pipeline/[clientSlug]/page.tsx` — per-client board

Both pages previously hardcoded `bg-[#F7F8FA] text-gray-900` on their page wrapper, which forced a light-mode-only surface. Replaced with `pipeline-bg min-h-[calc(100vh-3.5rem)] text-gray-900 dark:text-white` so the pages now flip with the Hub theme.

No other Hub page touches the class.

## Chrome readability on dark

The page-level chrome above the board (title, subtitle, search input, filter chips, per-client back button + "Client portal" link) previously assumed a light surface. Added `dark:` variants so everything stays legible on the dark gradient:

- Page title: `text-gray-900 dark:text-white`
- Search input: `bg-white dark:bg-white/5`, `border-gray-200 dark:border-white/10`, `text-gray-700 dark:text-white`
- FilterChip (inactive): `bg-white dark:bg-white/5`, `border-gray-200 dark:border-white/10`, `text-gray-600 dark:text-zinc-300`
- FilterChip (active): `bg-violet-50 dark:bg-violet-500/15`, `border-violet-200 dark:border-violet-400/30`, `text-violet-700 dark:text-violet-300`
- FilterChip count badge (inactive): `bg-gray-100 dark:bg-white/10`
- Per-client back button + Client portal link: analogous dark variants.

Cards and column wrappers were already white and stay that way, producing the classic "Trello on dark" look the brief asked for.

## Light-mode decision

Went with **option A (a lighter version of the same gradient)** rather than a plain solid background. Rationale: a completely flat `#F7F8FA` in light mode felt disconnected from the rest of the brand. The 6%-opacity brand-violet glow is subtle enough not to compete with card content but keeps a thread of visual continuity between the two themes — so if you toggle light/dark you see the same compositional idea in two volumes.

The light-mode glow is noticeably quieter than the dark one (~27% of the dark variant's opacity, smaller ellipse) so it reads as "a faint tint" rather than "a coloured background".

## Verification

- `npm run build` — **passing**.
- Dev server boot → `GET /pipeline` 200, `GET /pipeline/[slug]` 200.
- Column widths from the kanban-fixed-columns branch unchanged (still 272px each with horizontal scroll on the board container).

## Manual visual check

1. Hub in dark mode, open `/pipeline` — look at the bottom-left corner. You should see a soft violet glow bleeding up into the board. Top-right is near-black. Columns render as crisp white cards on the dark surface.
2. Toggle to light mode via Settings → Appearance → open `/pipeline` again. Same compositional idea, much quieter; feels like a barely-there warmth on the off-white.
3. Toggle back to dark and open `/pipeline/swipeup` (or any client slug) — same background treatment. The Client portal link + Create Brief button at the top right stay readable; the back button and client name at top-left stay readable against the near-black surface.
