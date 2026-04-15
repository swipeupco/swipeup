'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { ArrowRight, ChevronDown, LogIn, Loader2 } from 'lucide-react'

interface Client {
  id: string
  name: string
  slug: string
  color: string
  logo_url: string | null
}

interface BriefCounts {
  backlog: number
  in_production: number
  qa_review: number
  client_review: number
  approved: number
}

interface ClientUser {
  id: string
  name: string | null
  email: string | null
}

const STAGES = [
  { key: 'backlog',       label: 'Backlog',         bg: 'bg-zinc-100',   text: 'text-zinc-600' },
  { key: 'in_production', label: 'In Production',   bg: 'bg-amber-100',  text: 'text-amber-700' },
  { key: 'qa_review',     label: 'QA Review',       bg: 'bg-purple-100', text: 'text-purple-700' },
  { key: 'client_review', label: 'Client Review',   bg: 'bg-blue-100',   text: 'text-blue-700' },
  { key: 'approved',      label: 'Approved',        bg: 'bg-green-100',  text: 'text-green-700' },
]

export default function ClientsOverview() {
  const [clients, setClients]   = useState<Client[]>([])
  const [counts, setCounts]     = useState<Record<string, BriefCounts>>({})
  const [loading, setLoading]   = useState(true)

  // Impersonation state per client
  const [openDropdown, setOpenDropdown]   = useState<string | null>(null)
  const [clientUsers, setClientUsers]     = useState<Record<string, ClientUser[]>>({})
  const [loadingUsers, setLoadingUsers]   = useState<string | null>(null)
  const [impersonating, setImpersonating] = useState<string | null>(null) // userId being impersonated
  const dropdownRef = useRef<HTMLDivElement>(null)

  const router = useRouter()

  useEffect(() => {
    async function load() {
      const supabase = createClient()

      const { data: clientRows } = await supabase
        .from('clients')
        .select('*')
        .order('name')

      if (!clientRows) { setLoading(false); return }
      setClients(clientRows)

      const { data: briefs } = await supabase
        .from('briefs')
        .select('client_id, pipeline_status')

      const map: Record<string, BriefCounts> = {}
      clientRows.forEach(c => {
        map[c.id] = { backlog: 0, in_production: 0, qa_review: 0, client_review: 0, approved: 0 }
      })
      briefs?.forEach(b => {
        if (!b.client_id || !map[b.client_id]) return
        const stage = b.pipeline_status as keyof BriefCounts
        if (stage in map[b.client_id]) map[b.client_id][stage]++
      })
      setCounts(map)
      setLoading(false)
    }
    load()
  }, [])

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpenDropdown(null)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function toggleDropdown(clientId: string) {
    if (openDropdown === clientId) {
      setOpenDropdown(null)
      return
    }

    // Fetch users if we don't have them yet
    if (!clientUsers[clientId]) {
      setLoadingUsers(clientId)
      const res = await fetch(`/api/clients?clientId=${clientId}`)
      const json = await res.json()
      setClientUsers(prev => ({ ...prev, [clientId]: json.users ?? [] }))
      setLoadingUsers(null)
    }

    setOpenDropdown(clientId)
  }

  async function loginAs(userId: string) {
    setImpersonating(userId)
    try {
      const res = await fetch('/api/impersonate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
      const json = await res.json()
      if (json.link) {
        window.open(json.link, '_blank')
      } else {
        alert(json.error ?? 'Failed to generate login link')
      }
    } finally {
      setImpersonating(null)
      setOpenDropdown(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-6 w-6 border-2 border-[#14C29F] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const totalActive = Object.values(counts).reduce((sum, c) => sum + c.in_production + c.qa_review + c.client_review, 0)

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-zinc-900">Clients</h1>
        <p className="text-sm text-zinc-500 mt-1">{clients.length} clients · {totalActive} active briefs across all pipelines</p>
      </div>

      {/* Client cards */}
      <div className="grid grid-cols-1 gap-4 max-w-4xl" ref={dropdownRef}>
        {clients.map(client => {
          const c = counts[client.id] ?? { backlog: 0, in_production: 0, qa_review: 0, client_review: 0, approved: 0 }
          const total = Object.values(c).reduce((s, n) => s + n, 0)
          const users = clientUsers[client.id] ?? []
          const isOpen = openDropdown === client.id
          const isFetchingUsers = loadingUsers === client.id

          return (
            <div
              key={client.id}
              className="bg-white rounded-2xl border border-zinc-200 p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between gap-4">
                {/* Client info */}
                <div className="flex items-center gap-3">
                  <div
                    className="h-10 w-10 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                    style={{ backgroundColor: client.color }}
                  >
                    {client.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h2 className="font-semibold text-zinc-900">{client.name}</h2>
                    <p className="text-xs text-zinc-400">{total} briefs total</p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {/* Login as client dropdown */}
                  <div className="relative">
                    <button
                      onClick={() => toggleDropdown(client.id)}
                      className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium border border-zinc-200 text-zinc-600 hover:bg-zinc-50 transition-colors"
                    >
                      {isFetchingUsers
                        ? <Loader2 className="h-3 w-3 animate-spin" />
                        : <LogIn className="h-3 w-3" />
                      }
                      Login as
                      <ChevronDown className={`h-3 w-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {isOpen && (
                      <div className="absolute right-0 top-full mt-1.5 z-20 min-w-[200px] rounded-xl border border-zinc-200 bg-white shadow-lg py-1">
                        {users.length === 0 ? (
                          <p className="px-4 py-2.5 text-xs text-zinc-400">No users found for this client</p>
                        ) : (
                          users.map(u => (
                            <button
                              key={u.id}
                              onClick={() => loginAs(u.id)}
                              disabled={impersonating === u.id}
                              className="flex items-center gap-2.5 w-full px-4 py-2.5 text-left hover:bg-zinc-50 transition-colors disabled:opacity-50"
                            >
                              <div className="h-6 w-6 rounded-full bg-zinc-200 flex items-center justify-center text-[10px] font-bold text-zinc-600 flex-shrink-0">
                                {(u.name ?? u.email ?? '?').slice(0, 1).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-medium text-zinc-800 truncate">{u.name ?? '—'}</p>
                                <p className="text-[10px] text-zinc-400 truncate">{u.email}</p>
                              </div>
                              {impersonating === u.id && (
                                <Loader2 className="h-3 w-3 animate-spin text-zinc-400 ml-auto flex-shrink-0" />
                              )}
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => router.push(`/pipeline/${client.slug}`)}
                    className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-colors"
                    style={{ backgroundColor: client.color }}
                  >
                    View pipeline
                    <ArrowRight className="h-3 w-3" />
                  </button>
                </div>
              </div>

              {/* Stage pills */}
              <div className="flex gap-2 mt-4 flex-wrap">
                {STAGES.map(stage => {
                  const count = c[stage.key as keyof BriefCounts]
                  return (
                    <div
                      key={stage.key}
                      className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${stage.bg} ${stage.text}`}
                    >
                      <span>{stage.label}</span>
                      <span className="font-bold">{count}</span>
                    </div>
                  )
                })}
              </div>

              {/* Client review alert */}
              {c.client_review > 0 && (
                <div className="mt-3 flex items-center gap-2 rounded-lg bg-blue-50 border border-blue-100 px-3 py-2">
                  <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
                  <p className="text-xs text-blue-700 font-medium">
                    {c.client_review} brief{c.client_review !== 1 ? 's' : ''} waiting for client review
                  </p>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
