-- Task 1 — Profile columns for Hub theming + notification preferences.
-- Run against the shared Supabase project. Additive only.
--
-- Safety:
--   * All columns have defaults so existing rows backfill instantly.
--   * Portal does not read these columns today — no downstream impact.
--   * No destructive operations.

alter table public.profiles
  add column if not exists theme_preference text
    check (theme_preference in ('dark', 'light'))
    default 'dark';

alter table public.profiles
  add column if not exists notification_preferences jsonb
    default jsonb_build_object(
      'client_feedback',    true,
      'revisions_required', true,
      'brief_approved',     true,
      'brief_created',      true
    );

-- Backfill in case any existing row somehow has NULLs (e.g. a profile
-- inserted before these defaults were added).
update public.profiles
   set theme_preference = 'dark'
 where theme_preference is null;

update public.profiles
   set notification_preferences = jsonb_build_object(
         'client_feedback',    true,
         'revisions_required', true,
         'brief_approved',     true,
         'brief_created',      true
       )
 where notification_preferences is null;
