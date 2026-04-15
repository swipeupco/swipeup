export const dynamic = 'force-dynamic'

import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// GET /api/clients?clientId=xxx — returns users for a given client
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const clientId = searchParams.get('clientId')
  if (!clientId) return NextResponse.json({ users: [] })

  // Get profiles linked to this client
  const { data: profiles } = await supabaseAdmin
    .from('profiles')
    .select('id, name')
    .eq('client_id', clientId)

  if (!profiles?.length) return NextResponse.json({ users: [] })

  // Get emails from auth.users
  const users = await Promise.all(
    profiles.map(async (p) => {
      const { data } = await supabaseAdmin.auth.admin.getUserById(p.id)
      return { id: p.id, name: p.name, email: data.user?.email ?? null }
    })
  )

  return NextResponse.json({ users })
}
