export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/** Seed the Hub with Sophie + a handful of mock designers so the Team tab
 *  isn't empty while Eden ramps up. Idempotent — re-running only creates users
 *  that don't yet exist. Admin-gated by middleware.
 *
 *  Created users:
 *    sophie@theugcvault.com           (designer) — real teammate
 *    demo-alex@swipeupco.test         (designer) — mock
 *    demo-jamie@swipeupco.test        (designer) — mock
 *    demo-riley@swipeupco.test        (designer) — mock
 *
 *  No invite emails are sent. email_confirm:true so the users are
 *  immediately usable. Temporary passwords are returned in the response so
 *  Eden can share them (or trigger a reset) at her discretion.
 */

interface SeedUser {
  email: string
  name: string
  role: 'admin' | 'designer'
  mock?: boolean
}

const SEED_USERS: SeedUser[] = [
  { email: 'sophie@theugcvault.com',     name: 'Sophie',                   role: 'designer' },
  { email: 'demo-alex@swipeupco.test',   name: 'Alex Designer (demo)',    role: 'designer', mock: true },
  { email: 'demo-jamie@swipeupco.test',  name: 'Jamie Designer (demo)',   role: 'designer', mock: true },
  { email: 'demo-riley@swipeupco.test',  name: 'Riley Designer (demo)',   role: 'designer', mock: true },
]

function tempPassword() {
  const r = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)
  return `SwipeUp-${r.slice(0, 16)}`
}

export async function POST() {
  const admin = createAdminClient()
  const created: Array<{ email: string; id: string; password: string | null; alreadyExisted: boolean; mock: boolean }> = []

  for (const u of SEED_USERS) {
    // Is the user already here? auth.admin.listUsers has no "by email" filter,
    // so we page through once — for a small project this is plenty.
    const { data: existing } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 })
    const match = existing?.users.find(x => x.email?.toLowerCase() === u.email.toLowerCase())

    let userId: string
    let password: string | null = null
    let alreadyExisted = false

    if (match) {
      userId = match.id
      alreadyExisted = true
    } else {
      password = tempPassword()
      const { data: createRes, error } = await admin.auth.admin.createUser({
        email: u.email,
        password,
        email_confirm: true,
        user_metadata: { name: u.name, seeded_by: 'hub_pass_1' },
      })
      if (error || !createRes.user) {
        return NextResponse.json({ error: `create ${u.email} failed: ${error?.message ?? 'unknown'}` }, { status: 500 })
      }
      userId = createRes.user.id
    }

    // Upsert the profile row (create if missing; set hub_role + name regardless)
    await admin.from('profiles').upsert(
      {
        id:        userId,
        name:      u.name,
        hub_role:  u.role,
        is_staff:  true,
        is_admin:  u.role === 'admin',
      },
      { onConflict: 'id' }
    )

    created.push({ email: u.email, id: userId, password, alreadyExisted, mock: !!u.mock })
  }

  return NextResponse.json({ ok: true, users: created })
}
