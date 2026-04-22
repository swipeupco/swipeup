import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

/** Hub proxy (Next 16's rename of middleware — same runtime, same behaviour):
 *  - Requires an authenticated Supabase session on every /settings, /pipeline,
 *    /dashboard and All Clients route.
 *  - Gates admin-only surfaces (Team tab, seed endpoints) to users whose
 *    profile has hub_role='admin' (with is_admin fallback for pre-migration).
 *  - Auth and public assets are allowed through unconditionally.
 */

const ADMIN_ONLY = [
  '/settings/team',
  '/api/team/seed',
  '/api/team/upsert-role',
  '/api/team/client-assignments',
]

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Public: auth page, auth callback, login, public assets, logo asset
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/api/auth/') ||
    pathname.startsWith('/api/frameio-webhook') ||
    pathname === '/favicon.ico' ||
    pathname === '/SwipeUp_White.svg' ||
    pathname === '/swipeup-logo.png'
  ) {
    return NextResponse.next()
  }

  const res = NextResponse.next()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return req.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            res.cookies.set({ name, value, ...options })
          })
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    // For API routes, return 401. For pages, redirect to login.
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Admin-only surfaces
  const needsAdmin = ADMIN_ONLY.some(p => pathname === p || pathname.startsWith(p + '/'))
  if (needsAdmin) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('hub_role, is_admin')
      .eq('id', user.id)
      .maybeSingle()
    const p = profile as { hub_role?: string | null; is_admin?: boolean } | null
    const isAdmin = p?.hub_role === 'admin' || p?.is_admin === true
    if (!isAdmin) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'forbidden' }, { status: 403 })
      }
      return NextResponse.redirect(new URL('/settings/profile', req.url))
    }
  }

  return res
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
