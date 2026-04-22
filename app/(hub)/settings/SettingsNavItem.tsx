'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ComponentType, SVGProps } from 'react'

export function SettingsNavItem({
  href, label, Icon,
}: {
  href: string
  label: string
  Icon: ComponentType<SVGProps<SVGSVGElement>>
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
      <Icon className="h-4 w-4" />
      {label}
    </Link>
  )
}
