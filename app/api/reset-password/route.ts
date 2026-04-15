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
    const { userId } = await request.json()
    if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

    // Get user's email
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId)
    if (userError || !userData.user?.email) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Generate a password recovery link — Supabase sends the email automatically
    const { error } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email: userData.user.email,
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_CLIENT_URL ?? 'https://portal.swipeupco.com'}/auth/callback`,
      },
    })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
