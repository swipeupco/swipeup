'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutGrid, LogOut, Users, Kanban } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const nav = [
  { href: '/',         label: 'All Clients',         icon: LayoutGrid },
  { href: '/pipeline', label: 'Production Pipeline', icon: Kanban },
]

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ')
}

export function Sidebar() {
  const pathname = usePathname()
  const router   = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex w-56 flex-col bg-zinc-950 border-r border-zinc-800 text-white">
      {/* Logo */}
      <div className="flex items-center px-5 py-5 border-b border-zinc-800">
        <span className="text-xl font-black tracking-tight text-white">
          SwipeUp<span className="text-[#14C29F]">.</span>
        </span>
        <span className="ml-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mt-0.5">Hub</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = href === '/' ? pathname === '/' : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                active ? 'bg-[#14C29F] text-white' : 'text-zinc-400 hover:bg-zinc-900 hover:text-white'
              )}
            >
              <Icon className="h-[18px] w-[18px] flex-shrink-0" />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 pb-4 space-y-0.5">
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-zinc-400 hover:bg-zinc-900 hover:text-white transition-colors"
        >
          <LogOut className="h-[18px] w-[18px] flex-shrink-0" />
          Sign out
        </button>
      </div>
    </aside>
  )
}
