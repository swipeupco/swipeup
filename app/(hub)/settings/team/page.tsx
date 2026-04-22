import { redirect } from 'next/navigation'
import { Users } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'

/** Team management — admin only. Full implementation lands in Task 5.
 *  Server-gated so a designer can't URL-type their way in. */
export default async function TeamSettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('hub_role, is_admin')
    .eq('id', user.id)
    .maybeSingle()

  const role = (profile as { hub_role?: string | null })?.hub_role
    ?? ((profile as { is_admin?: boolean })?.is_admin ? 'admin' : 'designer')
  if (role !== 'admin') redirect('/settings/profile')

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 space-y-6 max-w-3xl">
      <div>
        <h2 className="text-base font-semibold text-[var(--text)]">Team</h2>
        <p className="text-sm text-[var(--text-muted)] mt-0.5">Manage Hub staff and their default client assignments.</p>
      </div>

      <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-2)] p-8 flex flex-col items-center justify-center text-center">
        <Users className="h-8 w-8 text-[var(--text-dim)] mb-3" />
        <p className="text-sm font-medium text-[var(--text)]">Team management arrives in Task 5.</p>
        <p className="text-xs text-[var(--text-muted)] mt-1 max-w-sm">
          This tab will list all Hub staff, support inviting teammates as admin or designer,
          and manage default client assignments.
        </p>
      </div>
    </div>
  )
}
