export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/** Default client assignments for staff.
 *  POST   { staffId, clientId }  → add
 *  DELETE { staffId, clientId }  → remove
 *  Admin-only (middleware-gated).
 */
export async function POST(request: Request) {
  const { staffId, clientId } = await request.json() as { staffId?: string; clientId?: string }
  if (!staffId || !clientId) return NextResponse.json({ error: 'staffId + clientId required' }, { status: 400 })
  const admin = createAdminClient()
  const { error } = await admin.from('staff_default_assignments')
    .upsert({ staff_id: staffId, client_id: clientId }, { onConflict: 'staff_id,client_id' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(request: Request) {
  const { staffId, clientId } = await request.json() as { staffId?: string; clientId?: string }
  if (!staffId || !clientId) return NextResponse.json({ error: 'staffId + clientId required' }, { status: 400 })
  const admin = createAdminClient()
  const { error } = await admin.from('staff_default_assignments')
    .delete().eq('staff_id', staffId).eq('client_id', clientId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
