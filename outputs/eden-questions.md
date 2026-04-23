# Questions / ambiguous decisions — for Eden to review

Claude logs ambiguous calls here instead of guessing. Each entry has the decision made plus reasoning so you can redirect in the morning.

---

## 1. Mock users — real auth vs seed-only
**Request:** "Create mock users as well. sophie@theugcvault.com (Designer role)."

**Decision:** Create real auth.users rows for Sophie + 2–3 mock designers via `supabase.auth.admin.createUser()` with `email_confirm: true` and a generated temporary password. Do NOT send invite emails tonight — you can trigger those from the Team tab in the morning once you've reviewed the user list.

**Mock designer emails used:** will be documented in the Task 5 output summary. I'll prefix them with `demo-` so they're easy to delete if you don't want them.

**Why:** Profiles.id FKs auth.users.id, so a profile row alone isn't viable. A real Supabase invite email goes to Sophie immediately, which feels wrong to trigger while you're asleep.

**To reverse:** delete from auth.users where email starts with 'demo-' (cascade drops profiles). Sophie's row can stay — she's the real intended team member.

---

## 2. Next pass: generic Products + Campaigns

From Eden's brief: "Rename `vans` → `products` with flexible `custom_fields JSONB`. Rename `shows` → `campaigns` same treatment. OTRV/Vacationer migrate using custom_fields for caravan-specific columns (year, model_name, site_number, hubspot_audience). Do not touch in this pass."

**Parked for the next pass.** Not touched by Task A / B / C.

---

## 3. Auto-delete approved briefs after 90 days

From Task B: both pipeline pages now display "Approved briefs auto-delete after 90 days" under the Approved column header. **No auto-delete logic was implemented** in this pass — only the visible notice.

**Next-pass scope:**
- Supabase scheduled function (pg_cron) that daily runs:
  ```sql
  delete from public.briefs
  where pipeline_status = 'approved'
    and internal_status = 'approved_by_client'
    and (updated_at is not null and updated_at < now() - interval '90 days')
  ```
  (or use `created_at` if `updated_at` isn't set on approval — verify the Portal sets `updated_at` correctly when transitioning to approved before enabling this).
- Cascade from `briefs` already drops `brief_comments`, `brief_attachments`, and `brief_assigned_users` via existing FK on-delete-cascade.
- Storage objects in `brief-attachments/{brief_id}/*` need a separate sweep — Supabase Storage doesn't cascade from DB rows. Either:
  (a) delete storage objects from within the pg_cron function via `storage.delete_object()`, or
  (b) run a Vercel cron job on a `/api/cron/sweep-approved` route that calls `supabase.storage.from('brief-attachments').remove([...])` after the DB delete.
- Also consider: a grace-period safeguard — don't delete if any attachment was uploaded in the last 7 days, in case the client is still adding late material.
- UI surface: if Eden wants "days remaining" on approved cards, that's a follow-on.

---
