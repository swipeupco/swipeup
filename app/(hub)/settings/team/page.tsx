import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TeamTab } from './TeamTab'

/** Team management — admin only. Full implementation. */
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

  return <TeamTab />
}
