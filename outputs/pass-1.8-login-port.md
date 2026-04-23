# Pass 1.8 — port Portal login/reset-password into the Hub

Branch: `hub-overhaul-pass-1`. Build: **passing**. Single atomic commit `e3c4e35`.

## What changed

| File | Change |
|---|---|
| `app/(auth)/layout.tsx` | Body now uses the Portal's `bg.png` backdrop with the zinc-950 fallback and centered card layout. |
| `app/(auth)/login/page.tsx` | Rewritten verbatim from `src/app/(auth)/login/page.tsx` in the Portal, with the two Hub-specific text changes. |
| `app/(auth)/reset-password/page.tsx` | **New** route — verbatim copy of the Portal's reset-password page. |
| `public/bg.png` | Copied from the Portal (was missing in the Hub). |
| `proxy.ts` | Allowlist extended to let `/reset-password` + `/bg.png` through unauthenticated so the reset flow works end-to-end. |

## Text differences vs Portal

- Heading: **"Team login"** (Portal: "Welcome back")
- Subtitle: **"SwipeUp Creative Hub"** (Portal: "Sign in to your marketing portal")

Everything else is identical: logo placement, dark card, label + input styling, `#4950F8` focus rings, glass-glow Sign in button (three-stop linear gradient + five-layer box-shadow + hover overlay + active-press transform), Forgot Password → "Check your email" flow, live-clock + "Built by SwipeUp" footer.

## Trimmed-down Hub-specific bits

- **No public "Sign up" footer** — the Hub is invite-only, so the Portal's `<a href="/signup">` line is removed. No `/signup` route was added.
- **No per-client subdomain (clientName) lookup** — the Portal switches the subtitle to `Sign in to {clientName} portal` when a `x-client-slug` cookie is present. The Hub isn't multi-tenant, so that code path is dropped entirely.
- **Post-login redirect → `/`** — the Hub's main landing page is All Clients at `/`; the Portal's redirect to `/dashboard` doesn't apply.
- **Reset redirect target** — Portal hardcodes `https://portal.swipeupco.com/auth/callback`. The Hub derives the base from `window.location.origin` so dev + preview + production all work, and points at the existing `/api/auth/callback` route (the Hub's callback already lives there; no new route needed).

## Reset-password flow end-to-end

1. User clicks "Forgot password?" on `/login` → enters email → `supabase.auth.resetPasswordForEmail(email, { redirectTo: '${origin}/api/auth/callback?next=/reset-password' })` fires.
2. Form flips to the "Check your email" success state.
3. User clicks the email link → hits Supabase's hosted page → bounces to `/api/auth/callback?code=…&next=/reset-password`.
4. Hub's callback route (`app/api/auth/callback/route.ts`) exchanges the code for a session and redirects to `/reset-password`.
5. `/reset-password` verifies the session is live (else redirects to `/login?error=reset_expired`), captures a new password (8-char min + match check), calls `supabase.auth.updateUser({ password })`, signs out, and redirects to `/login`.
6. User signs in with the new password.

## Verification

```
▲ Next.js 16.2.3 (Turbopack)
✓ Compiled successfully
Route (app)
├ ○ /login                    ← ported, 200
├ ○ /reset-password           ← new, 200
├ /bg.png                     ← served, 200
└ /SwipeUp_White.svg          ← served, 200
```

Dev-server smoke test hit all four and every one returned 200. Build passes. Branch pushed to `origin/hub-overhaul-pass-1` at `e3c4e35`.

## Manual verification once the preview rebuilds

1. Open `hub.swipeupco.com/login` — confirm the layered bg.png + dark card + glowing Sign in button match the Portal side-by-side.
2. Click "Forgot password?" → form slides to the reset view → submit an email → "Check your email" panel appears.
3. Open the reset email → follow the link → land on `/reset-password` with the Portal's exact styling → set a new password → redirected to `/login` → sign in.
