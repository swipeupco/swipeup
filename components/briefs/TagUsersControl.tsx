'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, X, Check } from 'lucide-react'

type User = { id: string; name: string | null; avatar_url: string | null }

function initialsOf(name: string | null | undefined) {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : parts[0].slice(0, 2).toUpperCase()
}

export default function TagUsersControl({
  briefId,
  clientId,
  tagged,
  tint = '#4950F8',
  onChange,
}: {
  briefId: string
  clientId: string
  tagged: User[]
  tint?: string
  onChange: () => void
}) {
  const [open, setOpen]         = useState(false)
  const [query, setQuery]       = useState('')
  const [eligible, setEligible] = useState<User[]>([])
  const [saving, setSaving]     = useState<string | null>(null)
  const popRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (popRef.current && !popRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  useEffect(() => {
    if (!open) return
    ;(async () => {
      const supabase = createClient()
      const [clientMembersRes, staffAccessRes] = await Promise.all([
        supabase.from('profiles').select('id, name, avatar_url').eq('client_id', clientId),
        supabase.from('staff_client_access').select('staff_id').eq('client_id', clientId),
      ])
      const staffIds = (staffAccessRes.data ?? []).map(r => r.staff_id as string)
      const staffProfiles = staffIds.length
        ? (await supabase.from('profiles').select('id, name, avatar_url').in('id', staffIds)).data ?? []
        : []
      const merged: Record<string, User> = {}
      ;[...(clientMembersRes.data ?? []), ...staffProfiles].forEach(p => { merged[p.id] = p as User })
      setEligible(Object.values(merged).sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '')))
    })()
  }, [open, clientId])

  async function toggle(user: User) {
    const supabase = createClient()
    setSaving(user.id)
    const isTagged = tagged.some(t => t.id === user.id)
    if (isTagged) {
      await supabase.from('brief_assigned_users').delete().eq('brief_id', briefId).eq('user_id', user.id)
    } else {
      await supabase.from('brief_assigned_users').insert({ brief_id: briefId, user_id: user.id })
    }
    setSaving(null)
    onChange()
  }

  const filtered = eligible.filter(u => (u.name ?? '').toLowerCase().includes(query.toLowerCase()))

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {tagged.map(u => (
        <div
          key={u.id}
          className="group flex items-center gap-1.5 rounded-full bg-gray-100 pl-0.5 pr-2 py-0.5 border border-gray-200"
          title={u.name ?? 'Unknown'}
        >
          <div
            className="h-5 w-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold overflow-hidden"
            style={{ backgroundColor: tint }}
          >
            {u.avatar_url
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={u.avatar_url} alt="" className="h-full w-full object-cover" />
              : initialsOf(u.name)}
          </div>
          <span className="text-[11px] font-medium text-gray-700 max-w-[90px] truncate">{u.name ?? 'Unknown'}</span>
          <button
            type="button"
            onClick={() => toggle(u)}
            className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-opacity"
            aria-label="Remove tag"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ))}

      <div className="relative" ref={popRef}>
        <button
          type="button"
          onClick={() => setOpen(v => !v)}
          className="flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold text-gray-600 border border-dashed border-gray-300 hover:border-gray-400 hover:text-gray-800 transition-colors"
        >
          <Plus className="h-3 w-3" />
          Tag users
        </button>
        {open && (
          <div className="absolute left-0 top-full mt-1 w-64 rounded-xl bg-white border border-gray-200 shadow-lg z-20 overflow-hidden">
            <input
              autoFocus
              type="text"
              placeholder="Search users…"
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="w-full px-3 py-2 text-sm border-b border-gray-100 focus:outline-none"
            />
            <div className="max-h-60 overflow-y-auto">
              {filtered.length === 0 && (
                <p className="text-xs text-gray-400 px-3 py-3">No matches</p>
              )}
              {filtered.map(u => {
                const isTagged = tagged.some(t => t.id === u.id)
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => toggle(u)}
                    disabled={saving === u.id}
                    className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-gray-50 transition-colors text-sm"
                  >
                    <div
                      className="h-6 w-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold overflow-hidden flex-shrink-0"
                      style={{ backgroundColor: tint }}
                    >
                      {u.avatar_url
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={u.avatar_url} alt="" className="h-full w-full object-cover" />
                        : initialsOf(u.name)}
                    </div>
                    <span className="flex-1 truncate text-gray-700">{u.name ?? 'Unknown'}</span>
                    {isTagged && <Check className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
