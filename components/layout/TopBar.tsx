'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronDown, LogOut, Settings as SettingsIcon, User } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { NotificationBell } from '@/components/layout/NotificationBell'

interface Profile {
  name: string | null
  avatar_url: string | null
  email: string | null
}

/** Slim top bar across every Hub page. Houses the SwipeUp logo, notification
 *  bell and profile avatar dropdown. Settings moved here from the sidebar bell
 *  slot so notifications can surface at a page level, not a nav level. */
export function TopBar() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data } = await supabase
        .from('profiles')
        .select('name, avatar_url')
        .eq('id', user.id)
        .maybeSingle()
      setProfile({
        name: (data as { name?: string | null })?.name ?? null,
        avatar_url: (data as { avatar_url?: string | null })?.avatar_url ?? null,
        email: user.email ?? null,
      })
    })
  }, [])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const initials = (profile?.name ?? profile?.email ?? '?').slice(0, 1).toUpperCase()

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-end gap-3 border-b border-[var(--border)] bg-[var(--surface)]/80 backdrop-blur px-5">
      <NotificationBell />

      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setMenuOpen(v => !v)}
          className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1.5 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-3)] transition-colors"
        >
          <span className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full bg-[var(--surface-3)] text-xs font-bold text-[var(--text)]">
            {profile?.avatar_url
              ? <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
              : initials
            }
          </span>
          <span className="hidden sm:inline max-w-[9rem] truncate">{profile?.name ?? 'My profile'}</span>
          <ChevronDown className="h-3.5 w-3.5 text-[var(--text-dim)]" />
        </button>
        {menuOpen && (
          <div className="absolute right-0 mt-2 w-56 rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-[var(--border-muted)]">
              <p className="text-xs font-semibold text-[var(--text)] truncate">{profile?.name ?? 'My profile'}</p>
              <p className="text-[11px] text-[var(--text-dim)] truncate">{profile?.email}</p>
            </div>
            <Link
              href="/settings/profile"
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)] transition-colors"
            >
              <User className="h-4 w-4" /> Profile
            </Link>
            <Link
              href="/settings/appearance"
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)] transition-colors"
            >
              <SettingsIcon className="h-4 w-4" /> Settings
            </Link>
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)] transition-colors border-t border-[var(--border-muted)]"
            >
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </div>
        )}
      </div>

      <Link href="/" className="flex items-center gap-2 pl-2 border-l border-[var(--border)]" aria-label="SwipeUp Hub">
        {/* SwipeUp_White.svg is white. In dark mode it renders as-is;
            in light mode we invert(1) to render near-black. */}
        <Image
          src="/SwipeUp_White.svg"
          alt="SwipeUp"
          width={96}
          height={22}
          priority
          className="h-5 w-auto dark:[filter:none] [filter:invert(1)]"
        />
      </Link>
    </header>
  )
}
