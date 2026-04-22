'use client'

import { useEffect, useState } from 'react'
import { Loader2, Check } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type Prefs = {
  client_feedback: boolean
  revisions_required: boolean
  brief_approved: boolean
  brief_created: boolean
}

const DEFAULT_PREFS: Prefs = {
  client_feedback: true,
  revisions_required: true,
  brief_approved: true,
  brief_created: true,
}

const ROWS: Array<{ key: keyof Prefs; label: string; description: string }> = [
  { key: 'client_feedback',    label: 'Client feedback',     description: 'A client left a comment on a brief you own.' },
  { key: 'revisions_required', label: 'Revisions required',  description: 'A client sent a brief back with revision notes.' },
  { key: 'brief_approved',     label: 'Brief approved',      description: 'A client approved a brief.' },
  { key: 'brief_created',      label: 'New brief created',   description: 'A client created a new brief on a board you manage.' },
]

export default function NotificationsSettings() {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data } = await supabase
        .from('profiles')
        .select('notification_preferences')
        .eq('id', user.id)
        .maybeSingle()
      const stored = (data as { notification_preferences?: Partial<Prefs> | null })?.notification_preferences
      setPrefs({ ...DEFAULT_PREFS, ...(stored ?? {}) })
      setLoading(false)
    })
  }, [])

  function toggle(key: keyof Prefs) {
    setPrefs(prev => ({ ...prev, [key]: !prev[key] }))
  }

  async function save() {
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }
    await supabase
      .from('profiles')
      .update({ notification_preferences: prefs })
      .eq('id', user.id)
    setSaving(false)
    setSaved(true); setTimeout(() => setSaved(false), 2000)
  }

  if (loading) return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="h-5 w-5 animate-spin text-[var(--brand)]" />
    </div>
  )

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 space-y-6 max-w-xl">
      <div>
        <h2 className="text-base font-semibold text-[var(--text)]">Notifications</h2>
        <p className="text-sm text-[var(--text-muted)] mt-0.5">Choose which events trigger a notification in the Hub bell.</p>
      </div>

      <div className="divide-y divide-[var(--border-muted)]">
        {ROWS.map(row => (
          <div key={row.key} className="flex items-center justify-between gap-4 py-3.5">
            <div>
              <p className="text-sm font-medium text-[var(--text)]">{row.label}</p>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">{row.description}</p>
            </div>
            <button
              onClick={() => toggle(row.key)}
              role="switch"
              aria-checked={prefs[row.key]}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0 ${
                prefs[row.key] ? 'bg-[var(--brand)]' : 'bg-[var(--surface-3)]'
              }`}
            >
              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition ${
                prefs[row.key] ? 'translate-x-5' : 'translate-x-0.5'
              }`} />
            </button>
          </div>
        ))}
      </div>

      <div className="flex justify-end">
        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-1.5 rounded-xl bg-[var(--brand)] hover:bg-[var(--brand-hover)] px-4 py-2 text-sm font-semibold text-white transition-colors disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : saved ? <Check className="h-3.5 w-3.5" /> : null}
          {saved ? 'Saved' : saving ? 'Saving…' : 'Save preferences'}
        </button>
      </div>
    </div>
  )
}
