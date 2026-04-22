'use client'

import { useEffect, useRef } from 'react'
import { useTheme } from 'next-themes'
import { createClient } from '@/lib/supabase/client'

/** Two-way sync between next-themes and profiles.theme_preference.
 *
 *  On mount: read the current user's stored preference (if any) and apply it.
 *  On theme change: write it back so the preference follows the account.
 *
 *  Falls back silently if the column doesn't exist yet (before migration is
 *  applied) — this keeps the hub bootable even in a partially-migrated env. */
export function ThemeSync() {
  const { theme, setTheme } = useTheme()
  const hydrated = useRef(false)

  // Pull stored preference on mount
  useEffect(() => {
    let cancelled = false
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user || cancelled) return
      const { data, error } = await supabase
        .from('profiles')
        .select('theme_preference')
        .eq('id', user.id)
        .maybeSingle()
      if (cancelled) return
      hydrated.current = true
      if (error) return
      const stored = (data as { theme_preference?: string } | null)?.theme_preference
      if (stored && stored !== theme) setTheme(stored)
    })
    return () => { cancelled = true }
    // intentionally run once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Persist theme changes after initial hydration
  useEffect(() => {
    if (!hydrated.current || !theme) return
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase
        .from('profiles')
        .update({ theme_preference: theme })
        .eq('id', user.id)
        .then(() => { /* silently no-op on failure (column may be missing in dev) */ })
    })
  }, [theme])

  return null
}
