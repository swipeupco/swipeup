export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/** GET /api/team/list — all Hub staff + their default client assignments.
 *  Middleware enforces auth; response is admin-aware — admins see everyone,
 *  designers see only themselves.
 */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data: me } = await supabase.from('profiles').select('hub_role, is_admin').eq('id', user.id).maybeSingle()
  const isAdmin = (me as { hub_role?: string | null; is_admin?: boolean } | null)?.hub_role === 'admin'
    || (me as { is_admin?: boolean } | null)?.is_admin === true

  // Use admin client so we can read every profile even when RLS is tight.
  const admin = createAdminClient()
  let profilesQuery = admin
    .from('profiles')
    .select('id, name, avatar_url, hub_role, is_admin, is_staff')
    .or('hub_role.eq.admin,hub_role.eq.designer,is_admin.eq.true,is_staff.eq.true')

  if (!isAdmin) {
    // Non-admins see only themselves
    profilesQuery = admin
      .from('profiles')
      .select('id, name, avatar_url, hub_role, is_admin, is_staff')
      .eq('id', user.id)
  }

  const { data: profiles } = await profilesQuery

  // Emails live in auth.users
  const ids = (profiles ?? []).map(p => p.id)
  const emailMap: Record<string, string | null> = {}
  if (ids.length) {
    // admin.auth.admin.listUsers is paginated; for the small staff set we can fetch a page
    const { data: listRes } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 })
    listRes?.users.forEach(u => { if (ids.includes(u.id)) emailMap[u.id] = u.email ?? null })
  }

  // Default client assignments per staff
  const { data: assignments } = await admin
    .from('staff_default_assignments')
    .select('staff_id, client_id')
    .in('staff_id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000'])

  const assignMap: Record<string, string[]> = {}
  assignments?.forEach((a: { staff_id: string; client_id: string }) => {
    if (!assignMap[a.staff_id]) assignMap[a.staff_id] = []
    assignMap[a.staff_id].push(a.client_id)
  })

  const team = (profiles ?? []).map(p => {
    const pr = p as { id: string; name: string | null; avatar_url: string | null; hub_role: string | null; is_admin: boolean | null }
    return {
      id:        pr.id,
      name:      pr.name,
      avatar_url: pr.avatar_url,
      email:     emailMap[pr.id] ?? null,
      role:      pr.hub_role ?? (pr.is_admin ? 'admin' : 'designer'),
      default_client_ids: assignMap[pr.id] ?? [],
    }
  })

  return NextResponse.json({ team, isAdmin })
}
