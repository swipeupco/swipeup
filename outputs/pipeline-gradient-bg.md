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

---

# Follow-up pass — dark-mode card + column styling

The first pass left the cards white on the new dark canvas, which felt mismatched. This follow-up makes cards and column wrappers dark-mode-native on the two pipeline boards only.

## Scope (unchanged)

- Applied to `/pipeline` (master) and `/pipeline/[clientSlug]` (per-client) only.
- All other surfaces (dashboard, All Clients, settings, brief drawer) untouched.
- Light mode on the pipeline pages: unchanged — cards stay white, columns stay white.
- `.pipeline-bg` gradient from the earlier commit unchanged.

## Card (dark)

`components/pipeline/PortalBoard.tsx::BriefCard`:

| Element | Light (unchanged) | Dark |
|---|---|---|
| Card surface | `bg-white` | `bg-[#161B26]` |
| Card border | `border-gray-100` | `border-white/[0.08]` |
| Card hover border | `hover:shadow-md` (shadow only) | `hover:border-white/[0.14]` (border-only, shadow removed on dark) |
| Card shadow | `shadow-sm` | removed (`dark:shadow-none`) |
| Client chip row separator | `border-gray-50` | `border-white/[0.06]` |
| Client name text | `text-gray-500` | `text-zinc-400` (≈#94A3B8) |
| Grip icon | `text-gray-200` | `text-white/20` |
| Title | `text-gray-800` | `text-slate-100` (≈#F1F5F9) |
| Revisions badge | `bg-red-50 text-red-500 border-red-100` | `bg-red-500/15 text-red-300 border-red-400/30` |
| With-client badge | `bg-blue-50 text-blue-600 border-blue-100` | `bg-blue-500/15 text-blue-300 border-blue-400/30` |
| "Not started" / "Awaiting draft" / due-date pills | `bg-gray-50 text-gray-400 border-gray-100` | `bg-white/5 text-zinc-400 border-white/10` |
| Assigned-designer separator | `border-gray-50` | `border-white/[0.06]` |
| Designer label | `text-gray-400` | `text-zinc-400` |
| Designer name | `text-gray-600` | `text-zinc-300` |

### Content type chip

Brand-coloured (per type), background opacity reduced on dark so the chips don't glare. Implemented via CSS custom properties + Tailwind arbitrary-property classes so the dark variant resolves at CSS time (no hydration flash):

- Light: `backgroundColor: {typeColor}18` (≈9% opacity)
- Dark:  `backgroundColor: {typeColor}10` (≈6% opacity)

Text colour stays the full brand hue on both. The chip's shape, typography, and icon are unchanged.

### Cover image placeholder (the pastel block when no cover is uploaded)

Same CSS-var-plus-arbitrary-class approach:

- Light: `linear-gradient(135deg, {typeColor}22 0%, {typeColor}44 100%)` — original gradient
- Dark:  flat `{typeColor}26` (≈15% opacity) — matches the brief's "brand colour tinted at ~15% opacity on the dark card"

The type icon inside stays at `opacity-30` (already theme-agnostic — it's the same colour as the background tint, just slightly stronger).

### Action buttons

Unchanged per the brief:
- Open Brief: brand-coloured (client colour), works as-is.
- View Draft (enabled): now gains dark variants for its outline button (`dark:border-white/10 dark:text-zinc-300 dark:hover:bg-white/5`).
- View Draft (disabled) and Approve (disabled): dark variants for the ghost state.
- Approve (enabled): emerald, works as-is.
- Request Revisions: red outline → `dark:border-red-400/30 dark:text-red-300 dark:hover:bg-red-500/10`.

## Column surfaces (dark)

Both pipeline pages' column wrappers:

| Element | Light | Dark |
|---|---|---|
| Column body | `bg-white` | `bg-[#0F1420]` (slightly darker than cards so cards pop) |
| Column border | `border-gray-100` | `border-white/[0.08]` |
| Column shadow | `shadow-sm` | removed |
| Column header separator | `border-gray-50` | `border-white/[0.06]` |
| Column title text | `text-gray-800` | `text-slate-100` |
| Count pill | `bg-gray-100 text-gray-400` | `bg-white/10 text-zinc-400` |
| Backlog "+" button (per-client only) | `text-gray-400 hover:bg-gray-100` | `text-zinc-400 hover:bg-white/10 hover:text-white` |
| Drop-target highlight | `bg-violet-50/50` | `bg-violet-500/10` |
| Empty-state box | `border-gray-200 bg-gray-50/50` | `border-white/[0.08] bg-white/[0.02]` |
| Empty-state text | `text-gray-400` | `text-zinc-500` |
| "See all N approved" button (per-client) | `border-gray-200 bg-white text-gray-500` | `border-white/10 bg-white/5 text-zinc-300` |
| Loading-skeleton pulse blocks | `bg-gray-200` | `bg-white/5` |

## Search + filter chips

The gradient-pass already added dark variants; verified they still read correctly against the new darker card surfaces. No further tuning needed.

## Implementation note

The dynamic-per-type backgrounds (content type chip background, cover placeholder) use CSS custom properties inline + Tailwind arbitrary-property classes:

```tsx
<span
  className="... [background-color:var(--chip-bg-light)] dark:[background-color:var(--chip-bg-dark)]"
  style={{
    ['--chip-bg-light' as string]: `${typeColor}18`,
    ['--chip-bg-dark'  as string]: `${typeColor}10`,
  } as React.CSSProperties}
>
```

This is SSR-safe — the `.dark` class is already on the `<html>` element before React hydrates (via next-themes' blocking init script), so the dark values resolve at CSS time. No `useTheme()` hook needed and no theme-flash on first paint.

## Verification

- `npm run build` — **passing**.
- Dev-server smoke test → `GET /pipeline` 200, `GET /pipeline/[slug]` 200.
- Visual result in dark: cards at `#161B26` sit on columns at `#0F1420`, which sit on the `#0B1220` canvas with the bottom-left violet glow. Three levels of elevation read clearly. Content type chips stay legibly brand-tinted without glaring. Linear-kanban feel.

