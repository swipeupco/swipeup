'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Bell, Mail, Loader2 } from 'lucide-react'

type EventType = 'mentioned' | 'new_comment' | 'ready_for_review' | 'status_change'

type Preference = {
  event_type: EventType
  email_enabled: boolean
  in_app_enabled: boolean
}

const EVENTS: { key: EventType; label: string; description: string; clientOnly?: boolean }[] = [
  {
    key: 'mentioned',
    label: 'Mentions',
    description: 'When someone @mentions you in a comment',
  },
  {
    key: 'new_comment',
    label: 'Comments on my briefs',
    description: 'When someone comments on a brief you created or are tagged on',
  },
  {
    key: 'ready_for_review',
    label: 'Ready for review',
    description: 'When a brief is ready for your review',
    clientOnly: true,
  },
  {
    key: 'status_change',
    label: 'Status changes',
    description: 'When a brief you’re tagged on changes status',
  },
]

export default function NotificationSettingsPage() {
  const [preferences, setPreferences] = useState<Record<EventType, Preference>>({} as any)
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    (async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      setUserId(user.id)

      const { data } = await supabase
        .from('notification_preferences')
        .select('event_type, email_enabled, in_app_enabled')
        .eq('user_id', user.id)

      const map: Record<EventType, Preference> = {} as any
      ;(data ?? []).forEach((p: any) => { map[p.event_type as EventType] = p })
      EVENTS.forEach(e => {
        if (!map[e.key]) {
          map[e.key] = { event_type: e.key, email_enabled: true, in_app_enabled: true }
        }
      })
      setPreferences(map)
      setLoading(false)
    })()
  }, [])

  async function togglePref(event: EventType, field: 'email_enabled' | 'in_app_enabled', value: boolean) {
    if (!userId) return
    const next = { ...preferences[event], [field]: value }
    setPreferences(prev => ({ ...prev, [event]: next }))

    const supabase = createClient()
    await supabase.from('notification_preferences').upsert({
      user_id:        userId,
      event_type:     event,
      email_enabled:  next.email_enabled,
      in_app_enabled: next.in_app_enabled,
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Notifications</h1>
      <p className="text-sm text-gray-500 mb-8">Choose how you want to be notified about activity on briefs.</p>

      <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
        <div className="grid grid-cols-[1fr_auto_auto] gap-x-6 items-center px-5 py-3 bg-gray-50 border-b border-gray-200">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Event</span>
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1">
            <Bell className="h-3 w-3" />
            In-app
          </span>
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1">
            <Mail className="h-3 w-3" />
            Email
          </span>
        </div>
        {EVENTS.map(e => {
          const p = preferences[e.key]
          return (
            <div key={e.key} className="grid grid-cols-[1fr_auto_auto] gap-x-6 items-center px-5 py-4 border-b border-gray-100 last:border-b-0">
              <div>
                <p className="text-sm font-semibold text-gray-900">{e.label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{e.description}</p>
              </div>
              <Toggle
                checked={!!p?.in_app_enabled}
                onChange={v => togglePref(e.key, 'in_app_enabled', v)}
              />
              <Toggle
                checked={!!p?.email_enabled}
                onChange={v => togglePref(e.key, 'email_enabled', v)}
              />
            </div>
          )
        })}
      </div>

      <p className="text-xs text-gray-400 mt-6">
        Emails are sent from notifications@swipeupco.com. You can unsubscribe or adjust any event at any time.
      </p>
    </div>
  )
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${checked ? 'bg-[#4950F8]' : 'bg-gray-200'}`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  )
}
