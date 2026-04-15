'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import {
  ArrowRight, LogIn, Loader2, Plus, X,
  CheckCircle2, Mail, Store, Truck,
  Palette, Upload, Copy, Check, UserPlus, Users,
  KeyRound, Trash2, ExternalLink, ChevronDown,
  ShieldCheck, UserCog,
} from 'lucide-react'

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

interface StaffMember {
  id: string
  name: string | null
  email: string | null
  clientIds: string[]
}

const STAGES = [
  { key: 'backlog',       label: 'Backlog',       bg: 'bg-zinc-100',   text: 'text-zinc-500' },
  { key: 'in_production', label: 'In Production', bg: 'bg-amber-100',  text: 'text-amber-700' },
  { key: 'qa_review',     label: 'QA Review',     bg: 'bg-purple-100', text: 'text-purple-700' },
  { key: 'client_review', label: 'Client Review', bg: 'bg-blue-100',   text: 'text-blue-700' },
  { key: 'approved',      label: 'Approved',      bg: 'bg-green-100',  text: 'text-green-700' },
]

const PRESET_COLORS = [
  '#14C29F', '#3b82f6', '#8b5cf6', '#ec4899',
  '#f97316', '#ef4444', '#eab308', '#06b6d4',
  '#10b981', '#6366f1', '#f43f5e', '#84cc16',
]

function slugify(str: string) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function portalUrl(slug: string) {
  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'portal.swipeupco.com'
  return `https://${slug}.${root}`
}

export default function ClientsOverview() {
  const [clients, setClients]   = useState<Client[]>([])
  const [counts, setCounts]     = useState<Record<string, BriefCounts>>({})
  const [loading, setLoading]   = useState(true)
  const [showNewClient, setShowNewClient] = useState(false)
  const [inviteTarget, setInviteTarget]   = useState<Client | null>(null)

  const [usersOpen, setUsersOpen]       = useState<string | null>(null)
  const [brandingOpen, setBrandingOpen] = useState<string | null>(null)
  const [clientUsers, setClientUsers]   = useState<Record<string, ClientUser[]>>({})
  const [loadingUsers, setLoadingUsers] = useState<string | null>(null)

  const [resettingId, setResettingId]   = useState<string | null>(null)
  const [removingId, setRemovingId]     = useState<string | null>(null)
  const [impersonating, setImpersonating] = useState<string | null>(null)
  const [resetDone, setResetDone]       = useState<string | null>(null)

  // Staff access
  const [accessOpen, setAccessOpen]     = useState<string | null>(null)
  const [staff, setStaff]               = useState<StaffMember[]>([])
  const [staffLoaded, setStaffLoaded]   = useState(false)
  const [togglingAccess, setTogglingAccess] = useState<string | null>(null)
  const [showInviteStaff, setShowInviteStaff] = useState(false)

  const router = useRouter()

  async function load() {
    const supabase = createClient()
    const { data: clientRows } = await supabase.from('clients').select('*').order('name')
    if (!clientRows) { setLoading(false); return }
    setClients(clientRows)

    const { data: briefs } = await supabase.from('briefs').select('client_id, pipeline_status')
    const map: Record<string, BriefCounts> = {}
    clientRows.forEach(c => { map[c.id] = { backlog: 0, in_production: 0, qa_review: 0, client_review: 0, approved: 0 } })
    briefs?.forEach(b => {
      if (!b.client_id || !map[b.client_id]) return
      const stage = b.pipeline_status as keyof BriefCounts
      if (stage in map[b.client_id]) map[b.client_id][stage]++
    })
    setCounts(map)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function fetchUsers(clientId: string) {
    if (clientUsers[clientId]) return
    setLoadingUsers(clientId)
    const res = await fetch(`/api/clients?clientId=${clientId}`)
    const json = await res.json()
    setClientUsers(prev => ({ ...prev, [clientId]: json.users ?? [] }))
    setLoadingUsers(null)
  }

  async function toggleUsers(clientId: string) {
    if (usersOpen === clientId) { setUsersOpen(null); return }
    await fetchUsers(clientId)
    setUsersOpen(clientId)
    setBrandingOpen(null)
  }

  async function handleResetPassword(userId: string) {
    setResettingId(userId)
    await fetch('/api/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    })
    setResettingId(null)
    setResetDone(userId)
    setTimeout(() => setResetDone(null), 3000)
  }

  async function handleRemoveUser(clientId: string, userId: string) {
    if (!confirm('Remove this user? They will lose portal access immediately.')) return
    setRemovingId(userId)
    await fetch('/api/remove-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    })
    setClientUsers(prev => ({
      ...prev,
      [clientId]: (prev[clientId] ?? []).filter(u => u.id !== userId),
    }))
    setRemovingId(null)
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
      if (json.link) window.open(json.link, '_blank')
      else alert(json.error ?? 'Failed to generate login link')
    } finally {
      setImpersonating(null)
    }
  }

  function handleBrandingUpdate(clientId: string, updates: Partial<Client>) {
    setClients(prev => prev.map(c => c.id === clientId ? { ...c, ...updates } : c))
  }

  async function loadStaff() {
    if (staffLoaded) return
    const res = await fetch('/api/staff-access')
    const json = await res.json()
    setStaff(json.staff ?? [])
    setStaffLoaded(true)
  }

  async function toggleAccess(clientId: string) {
    if (accessOpen === clientId) { setAccessOpen(null); return }
    await loadStaff()
    setAccessOpen(clientId)
    setUsersOpen(null)
    setBrandingOpen(null)
  }

  async function handleToggleAccess(staffId: string, clientId: string, hasAccess: boolean) {
    setTogglingAccess(staffId + clientId)
    const method = hasAccess ? 'DELETE' : 'POST'
    await fetch('/api/staff-access', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ staffId, clientId }),
    })
    setStaff(prev => prev.map(s => {
      if (s.id !== staffId) return s
      const clientIds = hasAccess
        ? s.clientIds.filter(id => id !== clientId)
        : [...s.clientIds, clientId]
      return { ...s, clientIds }
    }))
    setTogglingAccess(null)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-5 w-5 border-2 border-[#14C29F] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const totalActive = Object.values(counts).reduce((sum, c) => sum + c.in_production + c.qa_review + c.client_review, 0)

  return (
    <div className="p-8 max-w-5xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Clients</h1>
          <p className="text-sm text-zinc-400 mt-0.5">{clients.length} clients · {totalActive} active briefs</p>
        </div>
        <button
          onClick={() => setShowNewClient(true)}
          className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white bg-[#14C29F] hover:opacity-90 transition-opacity"
        >
          <Plus className="h-4 w-4" />
          New Client
        </button>
      </div>

      <div className="space-y-3">
        {clients.map(client => {
          const c = counts[client.id] ?? { backlog: 0, in_production: 0, qa_review: 0, client_review: 0, approved: 0 }
          const total = Object.values(c).reduce((s, n) => s + n, 0)
          const users = clientUsers[client.id] ?? []
          const isUsersOpen = usersOpen === client.id
          const isBrandingOpen = brandingOpen === client.id
          const isAccessOpen = accessOpen === client.id

          return (
            <div key={client.id} className="bg-white rounded-2xl border border-zinc-200 overflow-hidden">
              <div className="px-5 py-4">
                {/* Top row */}
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="h-10 w-10 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0 overflow-hidden"
                      style={{ backgroundColor: client.color }}
                    >
                      {client.logo_url
                        ? <img src={client.logo_url} alt={client.name} className="h-full w-full object-contain p-1 brightness-0 invert" />
                        : client.name.slice(0, 2).toUpperCase()
                      }
                    </div>
                    <div className="min-w-0">
                      <h2 className="font-semibold text-zinc-900 leading-none">{client.name}</h2>
                      <p className="text-xs text-zinc-400 mt-0.5">{total} briefs</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <a
                      href={portalUrl(client.slug)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium border border-zinc-200 text-zinc-500 hover:bg-zinc-50 transition-colors"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Portal
                    </a>
                    <button
                      onClick={() => router.push(`/pipeline/${client.slug}`)}
                      className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90"
                      style={{ backgroundColor: client.color }}
                    >
                      Pipeline <ArrowRight className="h-3 w-3" />
                    </button>
                  </div>
                </div>

                {/* Stage pills */}
                <div className="flex gap-1.5 mt-3 flex-wrap">
                  {STAGES.map(stage => (
                    <div key={stage.key} className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium ${stage.bg} ${stage.text}`}>
                      {stage.label} <span className="font-bold">{c[stage.key as keyof BriefCounts]}</span>
                    </div>
                  ))}
                  {c.client_review > 0 && (
                    <div className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold bg-blue-600 text-white ml-auto">
                      {c.client_review} awaiting review
                    </div>
                  )}
                </div>

                {/* Section toggles */}
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-zinc-100">
                  <button
                    onClick={() => { toggleUsers(client.id); setBrandingOpen(null) }}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                      isUsersOpen ? 'bg-zinc-900 text-white' : 'text-zinc-500 hover:bg-zinc-50 border border-zinc-200'
                    }`}
                  >
                    <Users className="h-3 w-3" />
                    Users
                    {loadingUsers === client.id
                      ? <Loader2 className="h-3 w-3 animate-spin" />
                      : <ChevronDown className={`h-3 w-3 transition-transform ${isUsersOpen ? 'rotate-180' : ''}`} />
                    }
                  </button>
                  <button
                    onClick={() => { setBrandingOpen(isBrandingOpen ? null : client.id); setUsersOpen(null); setAccessOpen(null) }}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                      isBrandingOpen ? 'bg-zinc-900 text-white' : 'text-zinc-500 hover:bg-zinc-50 border border-zinc-200'
                    }`}
                  >
                    <Palette className="h-3 w-3" />
                    Branding
                    <ChevronDown className={`h-3 w-3 transition-transform ${isBrandingOpen ? 'rotate-180' : ''}`} />
                  </button>
                  <button
                    onClick={() => { toggleAccess(client.id); setBrandingOpen(null) }}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                      isAccessOpen ? 'bg-zinc-900 text-white' : 'text-zinc-500 hover:bg-zinc-50 border border-zinc-200'
                    }`}
                  >
                    <ShieldCheck className="h-3 w-3" />
                    Team Access
                    <ChevronDown className={`h-3 w-3 transition-transform ${isAccessOpen ? 'rotate-180' : ''}`} />
                  </button>
                </div>
              </div>

              {/* Users panel */}
              {isUsersOpen && (
                <div className="border-t border-zinc-100 bg-zinc-50 px-5 py-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Portal Users</p>
                    <button
                      onClick={() => setInviteTarget(client)}
                      className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white bg-[#14C29F] hover:opacity-90 transition-opacity"
                    >
                      <UserPlus className="h-3 w-3" />
                      Invite User
                    </button>
                  </div>

                  {users.length === 0 ? (
                    <div className="text-center py-6 rounded-xl border border-dashed border-zinc-200 bg-white">
                      <Users className="h-6 w-6 text-zinc-300 mx-auto mb-2" />
                      <p className="text-xs text-zinc-400">No users yet</p>
                      <p className="text-[10px] text-zinc-300 mt-0.5">Invite a user to give them portal access</p>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {users.map(user => (
                        <div key={user.id} className="flex items-center gap-3 bg-white rounded-xl px-4 py-3 border border-zinc-100">
                          <div className="h-8 w-8 rounded-full bg-zinc-200 flex items-center justify-center text-xs font-bold text-zinc-600 flex-shrink-0">
                            {(user.name ?? user.email ?? '?').slice(0, 1).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-zinc-800 truncate">{user.name ?? '—'}</p>
                            <p className="text-xs text-zinc-400 truncate">{user.email}</p>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <button
                              onClick={() => loginAs(user.id)}
                              disabled={!!impersonating}
                              title="Preview portal as this user"
                              className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-zinc-500 border border-zinc-200 hover:bg-zinc-50 transition-colors disabled:opacity-40"
                            >
                              {impersonating === user.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <LogIn className="h-3 w-3" />}
                              Preview
                            </button>
                            <button
                              onClick={() => handleResetPassword(user.id)}
                              disabled={resettingId === user.id}
                              title="Send password reset email"
                              className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-medium border transition-colors disabled:opacity-40 ${
                                resetDone === user.id ? 'border-green-200 bg-green-50 text-green-600' : 'border-zinc-200 text-zinc-500 hover:bg-zinc-50'
                              }`}
                            >
                              {resettingId === user.id ? <Loader2 className="h-3 w-3 animate-spin" /> : resetDone === user.id ? <Check className="h-3 w-3" /> : <KeyRound className="h-3 w-3" />}
                              {resetDone === user.id ? 'Sent!' : 'Reset PW'}
                            </button>
                            <button
                              onClick={() => handleRemoveUser(client.id, user.id)}
                              disabled={removingId === user.id}
                              title="Remove user from portal"
                              className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-red-500 border border-red-100 hover:bg-red-50 transition-colors disabled:opacity-40"
                            >
                              {removingId === user.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                              Remove
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="mt-3 flex items-center gap-2 rounded-xl bg-white border border-zinc-200 px-3 py-2.5">
                    <p className="text-[11px] text-zinc-400 flex-1 truncate font-mono">{portalUrl(client.slug)}</p>
                    <CopyButton text={portalUrl(client.slug)} />
                  </div>
                </div>
              )}

              {/* Branding panel */}
              {isBrandingOpen && (
                <ClientBrandingEditor
                  client={client}
                  onUpdate={(updates) => handleBrandingUpdate(client.id, updates)}
                  onClose={() => setBrandingOpen(null)}
                />
              )}

              {/* Team Access panel */}
              {isAccessOpen && (
                <div className="border-t border-zinc-100 bg-zinc-50 px-5 py-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Team Access</p>
                      <p className="text-[11px] text-zinc-400 mt-0.5">Control which SwipeUp editors can access this portal</p>
                    </div>
                    <button
                      onClick={() => setShowInviteStaff(true)}
                      className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white bg-[#14C29F] hover:opacity-90 transition-opacity"
                    >
                      <UserPlus className="h-3 w-3" />
                      Add Editor
                    </button>
                  </div>
                  {staff.length === 0 ? (
                    <div className="text-center py-6 rounded-xl border border-dashed border-zinc-200 bg-white">
                      <UserCog className="h-6 w-6 text-zinc-300 mx-auto mb-2" />
                      <p className="text-xs text-zinc-400">No team members yet</p>
                      <p className="text-[10px] text-zinc-300 mt-0.5">Add an editor to grant portal access</p>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {staff.map(member => {
                        const hasAccess = member.clientIds.includes(client.id)
                        const toggling = togglingAccess === member.id + client.id
                        return (
                          <div key={member.id} className="flex items-center gap-3 bg-white rounded-xl px-4 py-3 border border-zinc-100">
                            <div className="h-8 w-8 rounded-full bg-zinc-200 flex items-center justify-center text-xs font-bold text-zinc-600 flex-shrink-0">
                              {(member.name ?? member.email ?? '?').slice(0, 1).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-zinc-800 truncate">{member.name ?? '—'}</p>
                              <p className="text-xs text-zinc-400 truncate">{member.email}</p>
                            </div>
                            <button
                              onClick={() => handleToggleAccess(member.id, client.id, hasAccess)}
                              disabled={toggling}
                              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all disabled:opacity-50 ${
                                hasAccess
                                  ? 'bg-green-100 text-green-700 hover:bg-red-50 hover:text-red-600'
                                  : 'bg-zinc-100 text-zinc-500 hover:bg-green-50 hover:text-green-700'
                              }`}
                            >
                              {toggling
                                ? <Loader2 className="h-3 w-3 animate-spin" />
                                : hasAccess
                                  ? <><Check className="h-3 w-3" /> Access granted</>
                                  : <>+ Grant access</>
                              }
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {showNewClient && (
        <NewClientModal onClose={() => setShowNewClient(false)} onCreated={() => { setShowNewClient(false); load() }} />
      )}
      {inviteTarget && (
        <InviteUserModal
          client={inviteTarget}
          onClose={() => setInviteTarget(null)}
          onDone={() => {
            setClientUsers(prev => { const n = { ...prev }; delete n[inviteTarget.id]; return n })
            if (usersOpen === inviteTarget.id) fetchUsers(inviteTarget.id)
            setInviteTarget(null)
          }}
        />
      )}
      {showInviteStaff && (
        <InviteStaffModal
          onClose={() => setShowInviteStaff(false)}
          onDone={(newMember) => {
            setStaff(prev => [...prev, newMember])
            setShowInviteStaff(false)
          }}
        />
      )}
    </div>
  )
}

// ─── Copy Button ──────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  function copy() { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000) }
  return (
    <button onClick={copy} className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors flex-shrink-0">
      {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}

// ─── Invite User Modal ────────────────────────────────────────────────────────

function InviteUserModal({ client, onClose, onDone }: { client: Client; onClose: () => void; onDone: () => void }) {
  const [email, setEmail]     = useState('')
  const [name, setName]       = useState('')
  const [inviting, setInviting] = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [done, setDone]       = useState(false)

  async function sendInvite() {
    if (!email.trim()) return
    setInviting(true); setError(null)
    const res = await fetch('/api/invite-client', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: client.id, email: email.trim(), name: name.trim() || null }),
    })
    const json = await res.json()
    setInviting(false)
    if (json.error) { setError(json.error); return }
    setDone(true)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: client.color }}>
              {client.name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <h2 className="font-bold text-zinc-900 text-sm">Invite User</h2>
              <p className="text-xs text-zinc-400">{client.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100"><X className="h-5 w-5" /></button>
        </div>
        {!done ? (
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wide block mb-1.5">Name</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Sarah Johnson"
                className="w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#14C29F]/30 focus:border-[#14C29F]" />
            </div>
            <div>
              <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wide block mb-1.5">Email *</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="sarah@brand.com"
                className="w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#14C29F]/30 focus:border-[#14C29F]" />
            </div>
            {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-2">{error}</p>}
            <button onClick={sendInvite} disabled={inviting || !email.trim()}
              className="w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-white bg-[#14C29F] disabled:opacity-50 hover:opacity-90 transition-opacity">
              {inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              {inviting ? 'Sending…' : 'Send Invite'}
            </button>
          </div>
        ) : (
          <div className="text-center space-y-4">
            <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center mx-auto">
              <CheckCircle2 className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="font-semibold text-zinc-900">Invite sent!</p>
              <p className="text-sm text-zinc-400 mt-1">{email}</p>
            </div>
            <div className="rounded-xl bg-zinc-50 border border-zinc-200 p-3">
              <p className="text-xs text-zinc-500 mb-2 font-medium">Their portal URL</p>
              <div className="flex items-center gap-2">
                <p className="text-[11px] text-zinc-400 flex-1 truncate font-mono">{portalUrl(client.slug)}</p>
                <CopyButton text={portalUrl(client.slug)} />
              </div>
            </div>
            <button onClick={onDone} className="w-full rounded-xl py-2.5 text-sm font-semibold text-white bg-[#14C29F] hover:opacity-90 transition-opacity">Done</button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Client Branding Editor ───────────────────────────────────────────────────

function ClientBrandingEditor({ client, onUpdate, onClose }: { client: Client; onUpdate: (u: Partial<Client>) => void; onClose: () => void }) {
  const [name, setName]       = useState(client.name)
  const [color, setColor]     = useState(client.color)
  const [logoUrl, setLogoUrl] = useState<string | null>(client.logo_url)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving]       = useState(false)
  const [saved, setSaved]         = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function uploadLogo(file: File) {
    if (!file.type.startsWith('image/')) return
    setUploading(true)
    const supabase = createClient()
    const ext = file.name.split('.').pop()
    const path = `logos/${client.id}/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('client-assets').upload(path, file, { upsert: true })
    if (!error) {
      const { data: { publicUrl } } = supabase.storage.from('client-assets').getPublicUrl(path)
      setLogoUrl(publicUrl)
    }
    setUploading(false)
  }

  async function save() {
    setSaving(true)
    const supabase = createClient()
    await supabase.from('clients').update({ name, color, logo_url: logoUrl }).eq('id', client.id)
    setSaving(false); setSaved(true)
    onUpdate({ name, color, logo_url: logoUrl })
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="border-t border-zinc-100 bg-zinc-50 px-5 py-4 space-y-4">
      <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Portal Branding</p>
      <div>
        <p className="text-xs font-medium text-zinc-600 mb-2">Logo</p>
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden border border-zinc-200" style={{ backgroundColor: color }}>
            {logoUrl ? <img src={logoUrl} alt="logo" className="h-full w-full object-contain p-1 brightness-0 invert" /> : <span className="text-white font-bold text-sm">{name.slice(0, 2).toUpperCase()}</span>}
          </div>
          <div className="flex gap-2">
            <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 transition-colors disabled:opacity-50">
              {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
              {uploading ? 'Uploading…' : logoUrl ? 'Replace' : 'Upload logo'}
            </button>
            {logoUrl && (
              <button onClick={() => setLogoUrl(null)} className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50 transition-colors">Remove</button>
            )}
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) uploadLogo(f) }} />
        </div>
        <p className="text-[10px] text-zinc-400 mt-1.5">PNG, SVG or JPG · shown on login page & sidebar</p>
      </div>
      <div>
        <p className="text-xs font-medium text-zinc-600 mb-1.5">Display Name</p>
        <input value={name} onChange={e => setName(e.target.value)} className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#14C29F]/20 focus:border-[#14C29F]" />
      </div>
      <div>
        <p className="text-xs font-medium text-zinc-600 mb-2">Accent Colour</p>
        <div className="flex items-center gap-2 flex-wrap">
          {PRESET_COLORS.map(c => (
            <button key={c} onClick={() => setColor(c)} className={`h-6 w-6 rounded-full border-2 transition-transform hover:scale-110 ${color === c ? 'border-zinc-900 scale-110' : 'border-transparent'}`} style={{ backgroundColor: c }} />
          ))}
          <input type="color" value={color} onChange={e => setColor(e.target.value)} className="h-6 w-8 cursor-pointer rounded border border-zinc-200 p-0.5" />
          <span className="text-xs text-zinc-400 font-mono">{color}</span>
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <button onClick={onClose} className="rounded-lg px-4 py-2 text-xs font-medium text-zinc-500 hover:bg-zinc-100 transition-colors">Cancel</button>
        <button onClick={save} disabled={saving} className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold text-white bg-zinc-900 hover:opacity-80 transition-opacity disabled:opacity-50">
          {saved ? <Check className="h-3 w-3" /> : null}
          {saved ? 'Saved!' : saving ? 'Saving…' : 'Save Branding'}
        </button>
      </div>
    </div>
  )
}

// ─── New Client Modal ─────────────────────────────────────────────────────────

function NewClientModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [step, setStep] = useState<'details' | 'invite' | 'done'>('details')
  const [name, setName]               = useState('')
  const [slug, setSlug]               = useState('')
  const [color, setColor]             = useState('#14C29F')
  const [hasShopify, setHasShopify]   = useState(false)
  const [hasVans, setHasVans]         = useState(false)
  const [savingClient, setSavingClient] = useState(false)
  const [createdClientId, setCreatedClientId] = useState<string | null>(null)
  const [createdSlug, setCreatedSlug]         = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName, setInviteName]   = useState('')
  const [inviting, setInviting]       = useState(false)
  const [inviteError, setInviteError] = useState<string | null>(null)

  function handleNameChange(val: string) { setName(val); setSlug(slugify(val)) }

  async function saveNewClient() {
    if (!name.trim() || !slug.trim()) return
    setSavingClient(true)
    const supabase = createClient()
    const { data, error } = await supabase.from('clients')
      .insert({ name: name.trim(), slug: slug.trim(), color, has_shopify: hasShopify, has_vans: hasVans, products_label: hasVans ? 'Inventory' : 'Products', logo_url: null })
      .select('id').single()
    setSavingClient(false)
    if (error) { alert(error.message); return }
    setCreatedClientId(data.id); setCreatedSlug(slug.trim()); setStep('invite')
  }

  async function sendInvite() {
    if (!inviteEmail.trim() || !createdClientId) return
    setInviting(true); setInviteError(null)
    const res = await fetch('/api/invite-client', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: createdClientId, email: inviteEmail.trim(), name: inviteName.trim() || null }),
    })
    const json = await res.json()
    setInviting(false)
    if (json.error) { setInviteError(json.error); return }
    setStep('done')
  }

  const loginUrl = portalUrl(createdSlug)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-100">
          <div>
            <h2 className="font-bold text-zinc-900">
              {step === 'details' ? 'New Client' : step === 'invite' ? 'Invite User' : 'All Done!'}
            </h2>
            <div className="flex items-center gap-1.5 mt-2">
              {(['details', 'invite', 'done'] as const).map((s, i) => (
                <div key={s} className={`h-1 w-8 rounded-full transition-colors ${s === step ? 'bg-[#14C29F]' : i < ['details','invite','done'].indexOf(step) ? 'bg-zinc-300' : 'bg-zinc-100'}`} />
              ))}
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100"><X className="h-5 w-5" /></button>
        </div>
        <div className="p-6">
          {step === 'details' && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wide block mb-1.5">Client Name *</label>
                <input type="text" value={name} onChange={e => handleNameChange(e.target.value)} placeholder="e.g. Blended Hair Fibres"
                  className="w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#14C29F]/20 focus:border-[#14C29F]" />
              </div>
              <div>
                <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wide block mb-1.5">Portal Subdomain *</label>
                <div className="flex items-center rounded-xl border border-zinc-200 overflow-hidden focus-within:ring-2 focus-within:ring-[#14C29F]/20 focus-within:border-[#14C29F]">
                  <input type="text" value={slug} onChange={e => setSlug(e.target.value)} placeholder="bhf"
                    className="flex-1 px-3 py-2.5 text-sm focus:outline-none" />
                  <span className="px-3 py-2.5 text-sm text-zinc-400 bg-zinc-50 border-l border-zinc-200 whitespace-nowrap">.portal.swipeupco.com</span>
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wide block mb-2">Accent Colour</label>
                <div className="flex flex-wrap gap-2">
                  {PRESET_COLORS.map(c => (
                    <button key={c} type="button" onClick={() => setColor(c)}
                      className={`h-7 w-7 rounded-full border-2 transition-transform hover:scale-110 ${color === c ? 'border-zinc-900 scale-110' : 'border-transparent'}`}
                      style={{ backgroundColor: c }} />
                  ))}
                  <input type="color" value={color} onChange={e => setColor(e.target.value)} className="h-7 w-7 rounded-full border-2 border-zinc-200 cursor-pointer" />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wide block mb-2">Features</label>
                <div className="space-y-2">
                  <label className="flex items-center gap-3 rounded-xl border border-zinc-200 px-4 py-3 cursor-pointer hover:bg-zinc-50">
                    <input type="checkbox" checked={hasShopify} onChange={e => setHasShopify(e.target.checked)} className="rounded" />
                    <Store className="h-4 w-4 text-zinc-400" />
                    <div>
                      <p className="text-sm font-medium text-zinc-800">Shopify Integration</p>
                      <p className="text-xs text-zinc-400">Shows Shopify tab in their portal</p>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 rounded-xl border border-zinc-200 px-4 py-3 cursor-pointer hover:bg-zinc-50">
                    <input type="checkbox" checked={hasVans} onChange={e => setHasVans(e.target.checked)} className="rounded" />
                    <Truck className="h-4 w-4 text-zinc-400" />
                    <div>
                      <p className="text-sm font-medium text-zinc-800">Caravan / Van Inventory</p>
                      <p className="text-xs text-zinc-400">Enables Shows, Shoots & Inventory tabs</p>
                    </div>
                  </label>
                </div>
              </div>
              <button onClick={saveNewClient} disabled={savingClient || !name.trim() || !slug.trim()}
                className="w-full rounded-xl py-2.5 text-sm font-semibold text-white bg-[#14C29F] disabled:opacity-50 hover:opacity-90 transition-opacity">
                {savingClient ? 'Creating…' : 'Create Client →'}
              </button>
            </div>
          )}
          {step === 'invite' && (
            <div className="space-y-4">
              <div className="rounded-xl bg-green-50 border border-green-100 p-3 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                <p className="text-sm text-green-700 font-medium">Client created! Invite their first user.</p>
              </div>
              <div>
                <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wide block mb-1.5">Contact Name</label>
                <input type="text" value={inviteName} onChange={e => setInviteName(e.target.value)} placeholder="e.g. Sarah Johnson"
                  className="w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#14C29F]/20 focus:border-[#14C29F]" />
              </div>
              <div>
                <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wide block mb-1.5">Email Address *</label>
                <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="sarah@brand.com"
                  className="w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#14C29F]/20 focus:border-[#14C29F]" />
              </div>
              {inviteError && <p className="text-sm text-red-700 bg-red-50 rounded-xl px-4 py-3">{inviteError}</p>}
              <div className="flex gap-2">
                <button onClick={onCreated} className="flex-1 rounded-xl py-2.5 text-sm font-medium text-zinc-600 border border-zinc-200 hover:bg-zinc-50 transition-colors">Skip</button>
                <button onClick={sendInvite} disabled={inviting || !inviteEmail.trim()}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-white bg-[#14C29F] disabled:opacity-50 hover:opacity-90 transition-opacity">
                  {inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                  {inviting ? 'Sending…' : 'Send Invite'}
                </button>
              </div>
            </div>
          )}
          {step === 'done' && (
            <div className="text-center py-4 space-y-4">
              <div className="h-14 w-14 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                <CheckCircle2 className="h-7 w-7 text-green-600" />
              </div>
              <div>
                <h3 className="font-bold text-zinc-900 text-lg">All done!</h3>
                <p className="text-sm text-zinc-400 mt-1">Invite sent to <span className="font-medium text-zinc-700">{inviteEmail}</span></p>
              </div>
              <div className="text-left rounded-xl bg-zinc-50 border border-zinc-200 p-4">
                <p className="text-xs font-semibold text-zinc-600 mb-2">Their portal URL</p>
                <div className="flex items-center gap-2">
                  <p className="text-[11px] text-zinc-400 flex-1 truncate font-mono">{loginUrl}</p>
                  <CopyButton text={loginUrl} />
                </div>
              </div>
              <button onClick={onCreated} className="w-full rounded-xl py-2.5 text-sm font-semibold text-white bg-[#14C29F] hover:opacity-90 transition-opacity">Back to Clients</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Invite Staff Modal ───────────────────────────────────────────────────────

function InviteStaffModal({ onClose, onDone }: {
  onClose: () => void
  onDone: (member: StaffMember) => void
}) {
  const [email, setEmail]   = useState('')
  const [name, setName]     = useState('')
  const [inviting, setInviting] = useState(false)
  const [error, setError]   = useState<string | null>(null)
  const [done, setDone]     = useState(false)
  const [newMember, setNewMember] = useState<StaffMember | null>(null)

  async function sendInvite() {
    if (!email.trim()) return
    setInviting(true); setError(null)
    const res = await fetch('/api/invite-staff', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim(), name: name.trim() || null }),
    })
    const json = await res.json()
    setInviting(false)
    if (json.error) { setError(json.error); return }
    const member: StaffMember = { id: json.userId, name: name.trim() || null, email: email.trim(), clientIds: [] }
    setNewMember(member)
    setDone(true)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-zinc-900 flex items-center justify-center">
              <UserCog className="h-4 w-4 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-zinc-900 text-sm">Add Team Member</h2>
              <p className="text-xs text-zinc-400">SwipeUp editor — invite-only access</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100"><X className="h-5 w-5" /></button>
        </div>
        {!done ? (
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wide block mb-1.5">Name</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Jordan Smith"
                className="w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#14C29F]/30 focus:border-[#14C29F]" />
            </div>
            <div>
              <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wide block mb-1.5">Email *</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="jordan@swipeupco.com"
                className="w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#14C29F]/30 focus:border-[#14C29F]" />
            </div>
            <p className="text-[11px] text-zinc-400 bg-zinc-50 rounded-lg px-3 py-2">
              They'll receive an invite email and log in at portal.swipeupco.com. You can then grant them access to specific clients.
            </p>
            {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-2">{error}</p>}
            <button onClick={sendInvite} disabled={inviting || !email.trim()}
              className="w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-white bg-[#14C29F] disabled:opacity-50 hover:opacity-90 transition-opacity">
              {inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              {inviting ? 'Sending…' : 'Send Invite'}
            </button>
          </div>
        ) : (
          <div className="text-center space-y-4">
            <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center mx-auto">
              <CheckCircle2 className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="font-semibold text-zinc-900">Invite sent to {email}</p>
              <p className="text-sm text-zinc-400 mt-1">Now grant them access to specific client portals using the Team Access panel.</p>
            </div>
            <button onClick={() => newMember && onDone(newMember)}
              className="w-full rounded-xl py-2.5 text-sm font-semibold text-white bg-[#14C29F] hover:opacity-90 transition-opacity">
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
