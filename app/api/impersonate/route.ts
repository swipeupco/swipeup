export const dynamic = 'force-dynamic'

import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// Uses service role key — server only, never exposed to browser
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function POST(request: Request) {
  try {
    const { userId } = await request.json()
    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 })
    }

    // Generate a magic link for the target user
    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: '', // will be overridden by userId
      options: { redirectTo: `${process.env.NEXT_PUBLIC_CLIENT_URL ?? 'https://offtrackrvhub.vercel.app'}/dashboard` }
    })

    // Use generateLink with user lookup instead
    const { data: userData } = await supabaseAdmin.auth.admin.getUserById(userId)
    if (!userData.user?.email) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: userData.user.email,
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_CLIENT_URL ?? 'https://offtrackrvhub.vercel.app'}/dashboard`
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
