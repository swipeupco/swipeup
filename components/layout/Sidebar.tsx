'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutGrid, LogOut, Kanban, LayoutDashboard, User } from 'lucide-react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { NotificationBell } from '@/components/layout/NotificationBell'

// Hub accent colour — SwipeUp teal
const COLOR = '#14C29F'

const nav = [
  { href: '/dashboard', label: 'Dashboard',          icon: LayoutDashboard },
  { href: '/',          label: 'All Clients',         icon: LayoutGrid },
  { href: '/pipeline',  label: 'Production Pipeline', icon: Kanban },
]

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ')
}

export function Sidebar() {
  const pathname = usePathname()
  const router   = useRouter()
  const [profile, setProfile] = useState<{ name: string | null; avatar_url: string | null } | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data } = await supabase
        .from('profiles').select('name, avatar_url').eq('id', user.id).single()
      if (data) setProfile({ name: data.name, avatar_url: data.avatar_url })
    })
  }, [])

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex w-64 flex-col bg-white border-r border-gray-100">

      {/* Logo / Brand */}
      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-gray-100 min-h-[64px]">
        <div
          className="h-7 w-7 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
          style={{ backgroundColor: COLOR }}
        >
          SU
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-sm font-bold text-gray-900">SwipeUp</span>
          <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Hub</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = href === '/'
            ? pathname === '/'
            : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                active
                  ? 'text-white'
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
              )}
              style={active ? { backgroundColor: COLOR } : {}}
            >
              <Icon className="h-[18px] w-[18px] flex-shrink-0" />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Notifications + Sign out */}
      <div className="px-3 pb-2 space-y-0.5">
        <div className="flex items-center gap-2 px-3 py-2">
          <NotificationBell />
          <span className="text-sm font-medium text-gray-500">Notifications</span>
        </div>
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-800 transition-colors"
        >
          <LogOut className="h-[18px] w-[18px] flex-shrink-0" />
          Sign out
        </button>
      </div>

      {/* Profile strip */}
      {profile && (
        <div className="flex items-center gap-2.5 px-4 py-3 border-t border-gray-100">
          <div className="h-8 w-8 rounded-full bg-gray-100 overflow-hidden flex-shrink-0 flex items-center justify-center">
            {profile.avatar_url
              ? <img src={profile.avatar_url} alt="avatar" className="h-full w-full object-cover" />
              : <User className="h-4 w-4 text-gray-400" />
            }
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-gray-900 truncate">{profile.name || 'My Profile'}</p>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="px-5 py-4 border-t border-gray-100 flex flex-col items-center gap-2">
        <p className="text-xs text-gray-400">Built by</p>
        <Image
          src="/swipeup-logo.png"
          alt="SwipeUp"
          width={100}
          height={28}
          className="object-contain opacity-40 hover:opacity-80 transition-opacity"
          unoptimized
        />
      </div>

    </aside>
  )
}
