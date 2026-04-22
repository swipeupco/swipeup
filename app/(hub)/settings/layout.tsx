import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { User, Bell, Palette, Users } from 'lucide-react'
import { SettingsNavItem } from './SettingsNavItem'

/** Settings layout — renders the tab rail on the left and the tab body on the
 *  right. Team tab is gated to admins only (server-side, so URL-typing a
 *  designer in is blocked at the layer below). Everything else is visible to
 *  any authenticated staff member. */
export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('hub_role, is_admin')
    .eq('id', user.id)
    .maybeSingle()

  const role = (profile as { hub_role?: string | null })?.hub_role
    ?? ((profile as { is_admin?: boolean })?.is_admin ? 'admin' : 'designer')
  const isAdmin = role === 'admin'

  const tabs: Array<{ href: string; label: string; icon: typeof User; admin?: boolean }> = [
    { href: '/settings/profile',       label: 'Profile',       icon: User },
    { href: '/settings/notifications', label: 'Notifications', icon: Bell },
    { href: '/settings/appearance',    label: 'Appearance',    icon: Palette },
    { href: '/settings/team',          label: 'Team',          icon: Users, admin: true },
  ]

  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[var(--text)]">Settings</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">Your account, preferences, and team management.</p>
      </div>

      <div className="grid grid-cols-[200px_1fr] gap-8">
        <nav className="flex flex-col gap-0.5">
          {tabs.map(tab => {
            if (tab.admin && !isAdmin) return null
            return <SettingsNavItem key={tab.href} href={tab.href} label={tab.label} Icon={tab.icon} />
          })}
        </nav>
        <div>{children}</div>
      </div>
    </div>
  )
}
