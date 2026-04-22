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
