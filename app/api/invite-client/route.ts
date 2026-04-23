export const dynamic = 'force-dynamic'

import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabaseAdmin = createAdminClient()

  try {
    const { clientId, email, name } = await request.json()

    if (!clientId || !email) {
      return NextResponse.json({ error: 'clientId and email are required' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      data: {
        client_id: clientId,
        role: 'client',
        name: name ?? null,
      },
      redirectTo: `${process.env.NEXT_PUBLIC_CLIENT_URL ?? 'https://portal.swipeupco.com'}/dashboard`,
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, userId: data.user?.id })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
