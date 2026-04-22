'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Bell, Mail, Loader2, Lock } from 'lucide-react'

type EventType = 'mentioned' | 'new_comment' | 'ready_for_review' | 'status_change'

type Preference = {
  event_type: EventType
  email_enabled: boolean
  in_app_enabled: boolean
}

const EVENTS: { key: EventType; label: string; description: string }[] = [
  {
    key: 'mentioned',
    label: 'When I’m @mentioned',
    description: 'Someone mentions you in a comment on a brief.',
  },
  {
    key: 'new_comment',
    label: 'Comments on briefs I’m tagged on',
    description: 'New comment on a brief you created or are tagged on.',
  },
  {
    key: 'ready_for_review',
    label: 'Briefs ready for my review',
    description: 'A brief moves into Client Review. Primarily for client users.',
  },
  {
    key: 'status_change',
    label: 'Status changes on tagged briefs',
    description: 'A brief you’re tagged on is approved or sent back for revisions.',
  },
]

export function NotificationSettingsSection() {
  const [prefs, setPrefs] = useState<Record<EventType, Preference>>({} as any)
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<EventType | null>(null)

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
        if (!map[e.key]) map[e.key] = { event_type: e.key, email_enabled: true, in_app_enabled: true }
      })
      setPrefs(map)
      setLoading(false)
    })()
  }, [])

  async function toggleEmail(event: EventType, value: boolean) {
    if (!userId) return
    setSaving(event)
    const next = { ...prefs[event], email_enabled: value, in_app_enabled: true }
    setPrefs(prev => ({ ...prev, [event]: next }))
    const supabase = createClient()
    await supabase.from('notification_preferences').upsert({
      user_id:        userId,
      event_type:     event,
      email_enabled:  value,
      in_app_enabled: true,
    })
    setSaving(null)
  }

  return (
    <div id="notifications" className="rounded-2xl border border-zinc-200 bg-white shadow-sm overflow-hidden scroll-mt-24">
      <div className="px-6 py-4 border-b border-zinc-100 flex items-center gap-2">
        <Bell className="h-4 w-4 text-zinc-500" />
        <h2 className="font-semibold text-zinc-900 text-sm">Notifications</h2>
      </div>

      {loading ? (
        <div className="p-6 flex items-center gap-2 text-zinc-400 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading preferences…
        </div>
      ) : (
        <>
          <div className="grid grid-cols-[1fr_96px_96px] items-center px-6 py-3 bg-zinc-50 border-b border-zinc-100">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Event</span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 text-center flex items-center justify-center gap-1">
              <Bell className="h-3 w-3" />
              In-app
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 text-center flex items-center justify-center gap-1">
              <Mail className="h-3 w-3" />
              Email
            </span>
          </div>
          <div className="divide-y divide-zinc-100">
            {EVENTS.map(e => {
              const p = prefs[e.key]
              const busy = saving === e.key
              return (
                <div key={e.key} className="grid grid-cols-[1fr_96px_96px] items-center px-6 py-4">
                  <div>
                    <p className="text-sm font-semibold text-zinc-900">{e.label}</p>
                    <p className="text-xs text-zinc-500 mt-0.5">{e.description}</p>
                  </div>
                  <div className="flex justify-center">
                    <ReadOnlyToggle />
                  </div>
                  <div className="flex justify-center">
                    <Toggle
                      checked={!!p?.email_enabled}
                      busy={busy}
                      onChange={v => toggleEmail(e.key, v)}
                    />
                  </div>
                </div>
              )
            })}
          </div>
          <p className="px-6 py-3 text-[11px] text-zinc-400 bg-zinc-50/60 border-t border-zinc-100">
            In-app notifications are always on. Changes save automatically.
          </p>
        </>
      )}
    </div>
  )
}

function Toggle({ checked, busy, onChange }: { checked: boolean; busy?: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => !busy && onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${checked ? 'bg-[#4950F8]' : 'bg-zinc-200'} ${busy ? 'opacity-60' : ''}`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  )
}

function ReadOnlyToggle() {
  return (
    <div
      role="switch"
      aria-checked="true"
      aria-disabled="true"
      title="In-app notifications are always on"
      className="relative inline-flex h-6 w-11 items-center rounded-full bg-zinc-300/80 cursor-not-allowed"
    >
      <span className="inline-block h-4 w-4 transform rounded-full bg-white translate-x-6 flex items-center justify-center">
        <Lock className="h-2.5 w-2.5 text-zinc-400" />
      </span>
    </div>
  )
}
