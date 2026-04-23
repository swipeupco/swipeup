'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'

/** Tab rail link for /settings/*. Active-state detection lives here because
 *  the parent layout is a server component and can't touch usePathname.
 *
 *  The `icon` prop is a pre-rendered ReactNode, not a component type —
 *  React Server Components can't serialize function values across the
 *  server/client boundary, so the server layout instantiates the JSX for us. */
export function SettingsNavItem({
  href, label, icon,
}: {
  href: string
  label: string
  icon: ReactNode
}) {
  const pathname = usePathname()
  const active = pathname === href || pathname.startsWith(href + '/')
  return (
    <Link
      href={href}
      className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
        active
          ? 'bg-[var(--brand-soft)] text-[var(--brand)]'
          : 'text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]'
      }`}
    >
      {icon}
      {label}
    </Link>
  )
}
