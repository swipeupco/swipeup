export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/** POST /api/team/upsert-role — admin sets someone's hub_role.
 *  Middleware pre-gates this route to admins only.
 */
export async function POST(request: Request) {
  const { userId, role } = await request.json() as { userId?: string; role?: string }
  if (!userId || !role) return NextResponse.json({ error: 'userId and role required' }, { status: 400 })
  if (role !== 'admin' && role !== 'designer') {
    return NextResponse.json({ error: 'role must be admin or designer' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { error } = await admin.from('profiles').update({ hub_role: role }).eq('id', userId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
