# Discoveries — things noticed during Pass 1 not on the original list

Each item has a recommendation. Eden decides.

---

## 1. `notifications` has no `user_id` filter

**What I noticed:** Every `.from('notifications')` query in the Hub fetches every row for every user. The bell, dashboard, and `/notifications` page all scroll through the same global pool. If Supabase RLS enforces per-user visibility, this is fine at runtime; if not, every staff member sees every notification.

**Why it matters:** A SwipeUp designer tagged on three clients shouldn't see `brief_approved` notifications for clients they don't own. Even with RLS, a missing `user_id` column means notifications can't be authored per-user at write time.

**Recommendation:** add `notifications.user_id uuid references auth.users(id)`. Backfill by inferring from the notification's brief → client → staff_default_assignments chain, or just accept historical notifications are global. Both Hub and Portal insert paths set `user_id` on future inserts.

## 2. BriefDrawer is shared between per-client and production pipelines but has pipeline-specific concerns

The drawer has two "modes" (internalMode on/off) and is imported from both. It's 400+ lines and mixes drawer chrome with workflow actions and a comment panel. Fine for now; worth splitting into `BriefDrawer` (shell + comments) + `BriefWorkflowActions` (push to client, draft link, approved banner) if it grows much more.

## 3. Two assignee picker components

- `InlineDesignerPicker` in `app/(hub)/pipeline/[clientSlug]/page.tsx`
- `AssigneePicker` in `app/(hub)/pipeline/page.tsx`

Both render a tiny avatar pill with a popover list. They should live in `components/pipeline/AssigneePicker.tsx` as one component. Small refactor — maybe 30m — for the next pass.

## 4. `pos` ordering on briefs never gets rewritten

The per-client board orders by `pos asc`. Drag-and-drop between columns (where applicable) doesn't update `pos`. As a result the order within a column gets stale once people start moving briefs around. Future: when dropping, write `pos = <midpoint between siblings>` or use `ltree`.

## 5. Client Assignments panel removed from Production Pipeline but not migrated

The old `client_assignments` table is still alive. The Hub no longer writes to it (Task 4 removed the panel), so it's drifting. Either:
- Decommission it and migrate any consumers to `staff_default_assignments`, or
- Keep it as the single-assignee canonical table and delete `staff_default_assignments`.

Decide before the next pass. Noted in `outputs/eden-questions.md`.

## 6. Tailwind v4 + `next-themes` in Next 16

Works. But there's no auto-fix if someone mistakenly puts theme-specific classes outside the `.dark` variant (e.g. `dark:bg-[var(--surface)]`). We don't need `dark:` prefixes anymore — tokens handle it. Existing pages in the codebase sometimes use `dark:bg-zinc-900` style prefixes (e.g. the login page); those are legacy and harmless, but they should be cleaned up.

## 7. Pipeline card hover state is subtle on dark

On dark mode, `hover:bg-[var(--surface-3)]` is barely distinguishable from `bg-[var(--surface-2)]`. Consider a sharper hover — a `ring-1 ring-[var(--brand-soft)]` or bumping the surface-3 token slightly brighter.

## 8. Portal's BriefCard wasn't available to Claude

Task 3 asked to "reuse the Portal's BriefCard". Since I can't access the Portal repo, I built a new HubBriefCard inferred from the `creative-requests:pipeline-portal.png` reference. If Eden wants pixel-exact parity, drop the Portal's BriefCard.tsx into a gist or share the file and I'll reconcile.
