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
    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 })
    }

    const { data: userData } = await supabaseAdmin.auth.admin.getUserById(userId)
    if (!userData.user?.email) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: userData.user.email,
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_CLIENT_URL ?? 'https://portal.swipeupco.com'}/dashboard`
      }
    })

    if (linkError || !linkData?.properties?.action_link) {
      return NextResponse.json({ error: linkError?.message ?? 'Failed to generate link' }, { status: 500 })
    }

    return NextResponse.json({ link: linkData.properties.action_link })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
