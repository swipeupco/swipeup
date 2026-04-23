# Pass 1.7 — drag from anywhere on the card

Branch: `hub-overhaul-pass-1`. Build: **passing.** Single atomic commit `08df091`.

## What changed

`components/pipeline/PortalBoard.tsx`:

1. **Moved `{...dragHandleProps}`** from the small `GripVertical` wrapper to the outermost card `<div>`. The entire card surface is now the drag handle.
2. **`GripVertical` icon stays** as a purely decorative hint that the card is draggable. Its wrapper no longer carries drag listeners.
3. **New `STOP_DRAG` helper** — an object of `onMouseDown` / `onTouchStart` / `onPointerDown` handlers that each call `e.stopPropagation()`. Spread on every interactive element inside the card:
   - `Open Brief` button
   - Action-button wrapper (`View Draft` + `Approve`)
   - `Request Revisions` button
   - Cover hover menu wrapper + file input
4. **Card cursor** switches to `cursor-grab` (and `cursor-grabbing` while actively dragging) so users get a visual affordance that the whole card is draggable.

## Why three event handlers, not just `onPointerDown`

@hello-pangea/dnd installs its sensor on **mousedown**, **touchstart**, and **pointerdown** depending on browser and input source. Stopping propagation on only one of the three leaves gaps (e.g. a Safari touch could still start a drag from a button press). Spreading `STOP_DRAG` handles all three paths uniformly.

## How click-vs-drag disambiguation works

The library watches for movement past a ~5 px threshold before starting a drag. If the user clicks and releases without moving, no drag fires and the React `onClick` handler on the card runs normally, opening the drawer. If they press-and-drag, the drag begins and `onClick` doesn't fire. This is built-in to the library — no extra code needed.

## Verification

- `npm run build` — **passes**.
- Dev server booted, routes `GET /pipeline` and `GET /pipeline/[clientSlug]` both return `200` via the proxy-auth redirect chain. No 500s in server logs.

## Manual test plan (to run in a real browser)

1. Open the preview deployment (or `npm run dev` locally) on `/pipeline` and a per-client `/pipeline/[slug]`.
2. Click anywhere on a card (no movement) → the brief drawer opens.
3. Press and hold anywhere on a card, then move the mouse → the card lifts and becomes draggable. Drop on another column and it should move.
4. Click the **Open Brief** button → drawer opens; no drag, no weird bubbling.
5. Click **View Draft** → opens the draft URL in a new tab; drawer does not open and no drag starts.
6. Click **Approve** / **Request Revisions** → their actions fire; no drag.
7. Click the cover's **Cover** hover menu and then **Replace / Upload / Delete cover** → each triggers its own action with no drag interference.
