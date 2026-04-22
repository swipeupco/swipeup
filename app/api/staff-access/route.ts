export const dynamic = 'force-dynamic'

import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

// GET /api/staff-access — list all staff members + their accessible client IDs
export async function GET() {
  const supabase = createAdminClient()
  const { data: staff } = await supabase
    .from('profiles')
    .select('id, name, email:id')
    .eq('is_staff', true)
    .order('name')

  if (!staff) return NextResponse.json({ staff: [] })

  // Get auth emails for staff
  const staffWithEmails = await Promise.all(
    staff.map(async (s) => {
      const { data: { user } } = await supabase.auth.admin.getUserById(s.id)
      const { data: access } = await supabase
        .from('staff_client_access')
        .select('client_id')
        .eq('staff_id', s.id)
      return {
        id: s.id,
        name: s.name,
        email: user?.email ?? null,
        clientIds: (access ?? []).map(a => a.client_id),
      }
    })
  )

  return NextResponse.json({ staff: staffWithEmails })
}

// POST /api/staff-access — grant access
export async function POST(request: Request) {
  const supabase = createAdminClient()
  const { staffId, clientId } = await request.json()
  if (!staffId || !clientId) return NextResponse.json({ error: 'staffId and clientId required' }, { status: 400 })

  const { error } = await supabase
    .from('staff_client_access')
    .upsert({ staff_id: staffId, client_id: clientId })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

// DELETE /api/staff-access — revoke access
export async function DELETE(request: Request) {
  const supabase = createAdminClient()
  const { staffId, clientId } = await request.json()
  if (!staffId || !clientId) return NextResponse.json({ error: 'staffId and clientId required' }, { status: 400 })

  const { error } = await supabase
    .from('staff_client_access')
    .delete()
    .eq('staff_id', staffId)
    .eq('client_id', clientId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
