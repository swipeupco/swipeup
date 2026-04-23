-- Task B — brief_attachments table + storage bucket + RLS
-- Run against the shared Supabase project. Additive only.
--
-- What this adds:
--   1. `brief_attachments` table keyed on brief_id with one-cover-per-brief
--      via a partial unique index on (brief_id) where is_cover = true.
--   2. RLS on brief_attachments so staff have full access and client users
--      only see/modify rows for briefs whose client_id matches their profile.
--   3. `brief-attachments` Storage bucket (public-read for authenticated
--      sessions) + bucket-level RLS on storage.objects with the same
--      staff/client access rule.
--
-- Bucket provisioning: Supabase's SQL dashboard will create the bucket via
-- `storage.create_bucket` if it doesn't exist. If your project blocks that
-- RPC (some cloud projects do), create the bucket `brief-attachments`
-- manually in the Supabase Storage UI first, then run this file. The
-- `insert … on conflict do nothing` variant below is safe to re-run.

-- ── 1. Table ────────────────────────────────────────────────────────────────

create table if not exists public.brief_attachments (
  id           uuid primary key default gen_random_uuid(),
  brief_id     uuid not null references public.briefs(id) on delete cascade,
  user_id      uuid not null references public.profiles(id),
  storage_path text not null,
  file_name    text not null,
  mime_type    text not null,
  size_bytes   bigint not null,
  is_cover     boolean not null default false,
  created_at   timestamptz not null default now()
);

create index if not exists idx_brief_attachments_brief_id
  on public.brief_attachments(brief_id);

-- One cover per brief. Partial unique index — only rows where is_cover=true
-- are constrained, non-cover rows are unrestricted.
create unique index if not exists uniq_brief_attachments_cover
  on public.brief_attachments(brief_id)
  where is_cover = true;

-- ── 2. Storage bucket ───────────────────────────────────────────────────────

-- Create the bucket idempotently. The `public` flag is true so the public
-- URLs work for image previews — RLS on storage.objects still governs
-- actual read/write perms below, so "public" here only enables public URL
-- signing, not anonymous access.
insert into storage.buckets (id, name, public)
values ('brief-attachments', 'brief-attachments', true)
on conflict (id) do nothing;

-- ── 3. RLS policies ─────────────────────────────────────────────────────────

alter table public.brief_attachments enable row level security;

-- Staff (is_admin, is_staff, or hub_role set) have full read/write access.
drop policy if exists brief_attachments_staff_all on public.brief_attachments;
create policy brief_attachments_staff_all on public.brief_attachments
  for all
  using (
    exists (
      select 1 from public.profiles
       where id = auth.uid()
         and (is_admin = true or is_staff = true or hub_role in ('admin', 'designer'))
    )
  )
  with check (
    exists (
      select 1 from public.profiles
       where id = auth.uid()
         and (is_admin = true or is_staff = true or hub_role in ('admin', 'designer'))
    )
  );

-- Client users can read + write attachments on briefs in their client_id.
drop policy if exists brief_attachments_client_rw on public.brief_attachments;
create policy brief_attachments_client_rw on public.brief_attachments
  for all
  using (
    exists (
      select 1
        from public.briefs b
        join public.profiles p on p.client_id = b.client_id
       where b.id = brief_attachments.brief_id
         and p.id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
        from public.briefs b
        join public.profiles p on p.client_id = b.client_id
       where b.id = brief_attachments.brief_id
         and p.id = auth.uid()
    )
  );

-- ── 4. Storage bucket RLS ───────────────────────────────────────────────────
-- Match the same access model on storage.objects for the brief-attachments
-- bucket. Object paths follow the convention:
--   brief-attachments/{brief_id}/{uuid}.{ext}
-- so the brief_id can be parsed out of the path for per-brief access checks.

-- Any authenticated user can upload into the bucket (staff + clients).
drop policy if exists brief_attachments_storage_insert on storage.objects;
create policy brief_attachments_storage_insert on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'brief-attachments');

-- Read: staff see everything in the bucket; clients see rows for their
-- client_id (matched via the brief_attachments join on storage_path).
drop policy if exists brief_attachments_storage_read on storage.objects;
create policy brief_attachments_storage_read on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'brief-attachments'
    and (
      exists (
        select 1 from public.profiles
         where id = auth.uid()
           and (is_admin = true or is_staff = true or hub_role in ('admin', 'designer'))
      )
      or exists (
        select 1
          from public.brief_attachments ba
          join public.briefs b on b.id = ba.brief_id
          join public.profiles p on p.client_id = b.client_id
         where ba.storage_path = storage.objects.name
           and p.id = auth.uid()
      )
    )
  );

-- Delete: same rule as read.
drop policy if exists brief_attachments_storage_delete on storage.objects;
create policy brief_attachments_storage_delete on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'brief-attachments'
    and (
      exists (
        select 1 from public.profiles
         where id = auth.uid()
           and (is_admin = true or is_staff = true or hub_role in ('admin', 'designer'))
      )
      or exists (
        select 1
          from public.brief_attachments ba
          join public.briefs b on b.id = ba.brief_id
          join public.profiles p on p.client_id = b.client_id
         where ba.storage_path = storage.objects.name
           and p.id = auth.uid()
      )
    )
  );
