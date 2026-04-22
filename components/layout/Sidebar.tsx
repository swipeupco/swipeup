'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutGrid, Kanban, LayoutDashboard, Settings } from 'lucide-react'

const nav = [
  { href: '/dashboard', label: 'Dashboard',           icon: LayoutDashboard },
  { href: '/',          label: 'All Clients',          icon: LayoutGrid },
  { href: '/pipeline',  label: 'Production Pipeline',  icon: Kanban },
  { href: '/settings',  label: 'Settings',             icon: Settings },
]

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ')
}

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex w-60 flex-col border-r border-[var(--border)] bg-[var(--surface)]">
      {/* Brand block */}
      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-[var(--border)] min-h-[56px]">
        <div className="h-7 w-7 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0 bg-[var(--brand)]">
          SU
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-sm font-bold text-[var(--text)]">SwipeUp</span>
          <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-dim)]">Hub</span>
        </div>
      </div>

      {/* Nav */}
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
                  ? 'bg-[var(--brand)] text-white'
                  : 'text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]'
              )}
            >
              <Icon className="h-[18px] w-[18px] flex-shrink-0" />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Footer: left empty for now — profile/actions moved to top bar */}
      <div className="px-5 py-4 border-t border-[var(--border)]">
        <p className="text-[10px] text-[var(--text-dim)] text-center">
          SwipeUp Hub — internal
        </p>
      </div>
    </aside>
  )
}
