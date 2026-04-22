'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { User } from 'lucide-react'
import { NotificationBell } from '@/components/layout/NotificationBell'

export function TopBar() {
  const router = useRouter()
  const [profile, setProfile] = useState<{ name: string | null; avatar_url: string | null } | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('profiles').select('name, avatar_url').eq('id', user.id).single()
        .then(({ data }) => setProfile(data))
    })
  }, [])

  return (
    <div className="flex items-center justify-between px-6 py-3 border-b border-gray-100 bg-white">
      <div />
      <div className="flex items-center gap-2">
        <NotificationBell />
        <button
          onClick={() => router.push('/settings')}
          className="flex items-center gap-2 rounded-xl bg-gray-50 border border-gray-100 px-3 py-2 hover:bg-gray-100 transition-colors"
        >
          <div className="h-7 w-7 rounded-full bg-gray-200 overflow-hidden flex items-center justify-center flex-shrink-0">
            {profile?.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.avatar_url} alt="avatar" className="h-full w-full object-cover" />
            ) : (
              <User className="h-3.5 w-3.5 text-gray-400" />
            )}
          </div>
          {profile?.name && (
            <span className="text-xs font-medium text-gray-700">{profile.name}</span>
          )}
        </button>
      </div>
    </div>
  )
}
