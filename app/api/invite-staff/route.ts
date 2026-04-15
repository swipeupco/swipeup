export const dynamic = 'force-dynamic'

import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  try {
    const { email, name } = await request.json()
    if (!email) return NextResponse.json({ error: 'email is required' }, { status: 400 })

    const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      data: { name: name ?? null, is_staff: true },
      redirectTo: `${process.env.NEXT_PUBLIC_CLIENT_URL ?? 'https://portal.swipeupco.com'}/dashboard`,
    })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Set is_staff = true on their profile
    await supabaseAdmin.from('profiles').upsert({
      id: data.user!.id,
      name: name ?? null,
      is_staff: true,
    })

    return NextResponse.json({ success: true, userId: data.user?.id })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
