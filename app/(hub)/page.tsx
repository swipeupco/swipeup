'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import {
  ArrowRight, Loader2, Plus, X, Search, MoreHorizontal,
  CheckCircle2, Mail, Store, Truck, Palette, Upload, Copy, Check,
  UserPlus, Users, KeyRound, Trash2, ExternalLink, LogIn,
  ShieldCheck, UserCog, AlertCircle,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

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
  ready_for_review: number
  approved: number
}

interface ClientUser { id: string; name: string | null; email: string | null }
interface StaffMember { id: string; name: string | null; email: string | null; clientIds: string[] }

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PRESET_COLORS = [
  '#4950F8', '#14C29F', '#3b82f6', '#8b5cf6', '#ec4899',
  '#f97316', '#ef4444', '#eab308', '#06b6d4', '#10b981', '#6366f1', '#f43f5e',
]

function slugify(str: string) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function portalUrl(slug: string) {
  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'portal.swipeupco.com'
  return `https://${slug}.${root}`
}

const STRIP_STAGES: Array<{ key: keyof BriefCounts; label: string; shortLabel: string }> = [
  { key: 'backlog',          label: 'Backlog',          shortLabel: 'Backlog' },
  { key: 'in_production',    label: 'In Production',    shortLabel: 'In Prod' },
  { key: 'ready_for_review', label: 'Ready for Review', shortLabel: 'Review' },
  { key: 'approved',         label: 'Approved',         shortLabel: 'Approved' },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ClientsOverview() {
  const [clients, setClients] = useState<Client[]>([])
  const [counts, setCounts]   = useState<Record<string, BriefCounts>>({})
  const [loading, setLoading] = useState(true)
  const [query, setQuery]     = useState('')
  const [attentionOnly, setAttentionOnly] = useState(false)

  const [showNewClient, setShowNewClient] = useState(false)
  const [inviteTarget, setInviteTarget]   = useState<Client | null>(null)
  const [showInviteStaff, setShowInviteStaff] = useState(false)

  const [expandedSection, setExpandedSection] = useState<{ clientId: string; section: 'users' | 'branding' | 'access' } | null>(null)
  const [clientUsers, setClientUsers]   = useState<Record<string, ClientUser[]>>({})
  const [loadingUsers, setLoadingUsers] = useState<string | null>(null)

  const [staff, setStaff]             = useState<StaffMember[]>([])
  const [staffLoaded, setStaffLoaded] = useState(false)

  const router = useRouter()

  async function load() {
    const supabase = createClient()
    const { data: clientRows } = await supabase.from('clients').select('*').order('name')
    if (!clientRows) { setLoading(false); return }
    setClients(clientRows)

    const { data: briefs } = await supabase.from('briefs').select('client_id, pipeline_status')
    const map: Record<string, BriefCounts> = {}
    clientRows.forEach(c => { map[c.id] = { backlog: 0, in_production: 0, ready_for_review: 0, approved: 0 } })
    briefs?.forEach(b => {
      if (!b.client_id || !map[b.client_id]) return
      const s = b.pipeline_status
      if (s === 'backlog')        map[b.client_id].backlog++
      else if (s === 'approved')   map[b.client_id].approved++
      else if (s === 'client_review') map[b.client_id].ready_for_review++
      else                         map[b.client_id].in_production++ // in_production + qa_review
    })
    setCounts(map)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    let list = clients
    if (q) list = list.filter(c => c.name.toLowerCase().includes(q))
    if (attentionOnly) list = list.filter(c => (counts[c.id]?.ready_for_review ?? 0) > 0)
    return list
  }, [clients, counts, query, attentionOnly])

  const totalActive = useMemo(() =>
    Object.values(counts).reduce((s, c) => s + c.in_production + c.ready_for_review, 0),
  [counts])

  const attentionCount = useMemo(() =>
    Object.values(counts).filter(c => c.ready_for_review > 0).length,
  [counts])

  // ─── Expansion handlers ──────────────────────────────────────────────────────

  async function openUsers(clientId: string) {
    setExpandedSection({ clientId, section: 'users' })
    if (clientUsers[clientId]) return
    setLoadingUsers(clientId)
    const res = await fetch(`/api/clients?clientId=${clientId}`)
    const json = await res.json()
    setClientUsers(prev => ({ ...prev, [clientId]: json.users ?? [] }))
    setLoadingUsers(null)
  }
  async function openBranding(clientId: string) {
    setExpandedSection({ clientId, section: 'branding' })
  }
  async function openAccess(clientId: string) {
    setExpandedSection({ clientId, section: 'access' })
    if (staffLoaded) return
    const res = await fetch('/api/staff-access')
    const json = await res.json()
    setStaff(json.staff ?? [])
    setStaffLoaded(true)
  }
  function closeExpanded() { setExpandedSection(null) }

  function handleBrandingUpdate(clientId: string, updates: Partial<Client>) {
    setClients(prev => prev.map(c => c.id === clientId ? { ...c, ...updates } : c))
  }

  async function handleResetPassword(userId: string) {
    await fetch('/api/reset-password', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    })
  }
  async function handleRemoveUser(clientId: string, userId: string) {
    if (!confirm('Remove this user? They will lose portal access immediately.')) return
    await fetch('/api/remove-user', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    })
    setClientUsers(prev => ({ ...prev, [clientId]: (prev[clientId] ?? []).filter(u => u.id !== userId) }))
  }
  async function loginAs(userId: string) {
    const res = await fetch('/api/impersonate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    })
    const json = await res.json()
    if (json.link) window.open(json.link, '_blank')
    else alert(json.error ?? 'Failed to generate login link')
  }
  async function handleToggleAccess(staffId: string, clientId: string, hasAccess: boolean) {
    const method = hasAccess ? 'DELETE' : 'POST'
    await fetch('/api/staff-access', {
      method, headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ staffId, clientId }),
    })
    setStaff(prev => prev.map(s => {
      if (s.id !== staffId) return s
      const clientIds = hasAccess ? s.clientIds.filter(id => id !== clientId) : [...s.clientIds, clientId]
      return { ...s, clientIds }
    }))
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="h-5 w-5 animate-spin text-[var(--brand)]" />
    </div>
  )

  return (
    <div className="p-8 max-w-5xl">

      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text)]">All Clients</h1>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">{clients.length} clients · {totalActive} active briefs</p>
        </div>
        <button
          onClick={() => setShowNewClient(true)}
          className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white bg-[var(--brand)] hover:bg-[var(--brand-hover)] transition-colors"
        >
          <Plus className="h-4 w-4" />
          New Client
        </button>
      </div>

      {/* Search + filter chips */}
      <div className="flex items-center gap-3 mb-5">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-dim)]" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search clients..."
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-sm text-[var(--text)] placeholder:text-[var(--text-dim)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-ring)] focus:border-[var(--brand)]"
          />
        </div>
        <button
          onClick={() => setAttentionOnly(v => !v)}
          className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-colors border ${
            attentionOnly
              ? 'bg-[var(--brand-soft)] border-[var(--brand)] text-[var(--brand)]'
              : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-2)]'
          }`}
        >
          <AlertCircle className="h-3.5 w-3.5" />
          Attention required
          {attentionCount > 0 && (
            <span className={`rounded-full text-[10px] font-bold px-1.5 py-0.5 ${
              attentionOnly ? 'bg-[var(--brand)] text-white' : 'bg-[var(--surface-3)] text-[var(--text)]'
            }`}>
              {attentionCount}
            </span>
          )}
        </button>
      </div>

      {/* Rows */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)]">
          <Users className="h-8 w-8 text-[var(--text-dim)] mb-3" />
          <p className="text-sm font-medium text-[var(--text)]">No clients match</p>
          <p className="text-xs text-[var(--text-muted)] mt-1">Try clearing the search or filter.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(client => {
            const c = counts[client.id] ?? { backlog: 0, in_production: 0, ready_for_review: 0, approved: 0 }
            const isExpanded = expandedSection?.clientId === client.id
            return (
              <ClientRow
                key={client.id}
                client={client}
                counts={c}
                expanded={isExpanded ? expandedSection.section : null}
                users={clientUsers[client.id] ?? []}
                loadingUsers={loadingUsers === client.id}
                staff={staff}
                onOpenBoard={() => router.push(`/pipeline/${client.slug}`)}
                onStageClick={(stageKey) => router.push(`/pipeline/${client.slug}?col=${stageKey}`)}
                onOpenUsers={() => openUsers(client.id)}
                onOpenBranding={() => openBranding(client.id)}
                onOpenAccess={() => openAccess(client.id)}
                onClose={closeExpanded}
                onInviteUser={() => setInviteTarget(client)}
                onInviteStaff={() => setShowInviteStaff(true)}
                onBrandingUpdate={(u) => handleBrandingUpdate(client.id, u)}
                onResetPassword={handleResetPassword}
                onRemoveUser={(userId) => handleRemoveUser(client.id, userId)}
                onLoginAs={loginAs}
                onToggleAccess={handleToggleAccess}
              />
            )
          })}
        </div>
      )}

      {/* Modals */}
      {showNewClient && (
        <NewClientModal onClose={() => setShowNewClient(false)} onCreated={() => { setShowNewClient(false); load() }} />
      )}
      {inviteTarget && (
        <InviteUserModal
          client={inviteTarget}
          onClose={() => setInviteTarget(null)}
          onDone={() => {
            setClientUsers(prev => { const n = { ...prev }; delete n[inviteTarget.id]; return n })
            if (expandedSection?.clientId === inviteTarget.id && expandedSection.section === 'users') {
              openUsers(inviteTarget.id)
            }
            setInviteTarget(null)
          }}
        />
      )}
      {showInviteStaff && (
        <InviteStaffModal
          onClose={() => setShowInviteStaff(false)}
          onDone={(newMember) => { setStaff(prev => [...prev, newMember]); setShowInviteStaff(false) }}
        />
      )}
    </div>
  )
}

// ─── ClientRow ────────────────────────────────────────────────────────────────

function ClientRow({
  client, counts, expanded, users, loadingUsers, staff,
  onOpenBoard, onStageClick,
  onOpenUsers, onOpenBranding, onOpenAccess, onClose,
  onInviteUser, onInviteStaff, onBrandingUpdate,
  onResetPassword, onRemoveUser, onLoginAs, onToggleAccess,
}: {
  client: Client
  counts: BriefCounts
  expanded: 'users' | 'branding' | 'access' | null
  users: ClientUser[]
  loadingUsers: boolean
  staff: StaffMember[]
  onOpenBoard: () => void
  onStageClick: (key: keyof BriefCounts) => void
  onOpenUsers: () => void
  onOpenBranding: () => void
  onOpenAccess: () => void
  onClose: () => void
  onInviteUser: () => void
  onInviteStaff: () => void
  onBrandingUpdate: (u: Partial<Client>) => void
  onResetPassword: (userId: string) => Promise<void>
  onRemoveUser: (userId: string) => Promise<void>
  onLoginAs: (userId: string) => Promise<void>
  onToggleAccess: (staffId: string, clientId: string, hasAccess: boolean) => Promise<void>
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const totalBriefs = counts.backlog + counts.in_production + counts.ready_for_review + counts.approved

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function fireMenu(action: () => void) { setMenuOpen(false); action() }

  return (
    <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] overflow-hidden transition-colors">
      <div className="px-5 py-4 flex items-center gap-4">
        {/* Left: logo + name */}
        <div className="flex items-center gap-3 min-w-0 w-56 flex-shrink-0">
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
            <h2 className="font-semibold text-[var(--text)] text-sm truncate">{client.name}</h2>
            <p className="text-[11px] text-[var(--text-muted)] mt-0.5">{totalBriefs} {totalBriefs === 1 ? 'brief' : 'briefs'}</p>
          </div>
        </div>

        {/* Middle: mini pipeline strip */}
        <div className="flex-1 flex items-center gap-1 min-w-0">
          {STRIP_STAGES.map((stage, idx) => {
            const n = counts[stage.key]
            const isReview = stage.key === 'ready_for_review'
            const highlight = isReview && n > 0
            return (
              <button
                key={stage.key}
                onClick={() => onStageClick(stage.key)}
                className={`group flex-1 flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 transition-colors min-w-0 ${
                  highlight
                    ? 'bg-[var(--brand-soft)] hover:bg-[var(--brand)]/20'
                    : 'bg-[var(--surface-2)] hover:bg-[var(--surface-3)]'
                }`}
                title={`Jump to ${stage.label}`}
              >
                <span className={`text-[10px] font-semibold uppercase tracking-wide truncate ${
                  highlight ? 'text-[var(--brand)]' : 'text-[var(--text-muted)]'
                }`}>
                  {stage.shortLabel}
                </span>
                <span className={`text-sm font-bold flex-shrink-0 ${
                  highlight ? 'text-[var(--brand)]' : n > 0 ? 'text-[var(--text)]' : 'text-[var(--text-dim)]'
                }`}>
                  {n}
                </span>
              </button>
            )
          })}
        </div>

        {/* Right: Open Board + overflow menu */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={onOpenBoard}
            className="flex items-center gap-1.5 rounded-xl bg-[var(--brand)] hover:bg-[var(--brand-hover)] px-3.5 py-2 text-xs font-semibold text-white transition-colors"
          >
            Open board
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(v => !v)}
              aria-label="More actions"
              className="flex items-center justify-center h-8 w-8 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-3)] transition-colors"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full mt-1 w-44 rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-xl overflow-hidden z-10">
                <button onClick={() => fireMenu(onOpenUsers)} className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)] transition-colors">
                  <Users className="h-3.5 w-3.5" /> Portal users
                </button>
                <button onClick={() => fireMenu(onOpenBranding)} className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)] transition-colors">
                  <Palette className="h-3.5 w-3.5" /> Branding
                </button>
                <button onClick={() => fireMenu(onOpenAccess)} className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)] transition-colors">
                  <ShieldCheck className="h-3.5 w-3.5" /> Team access
                </button>
                <a
                  href={portalUrl(client.slug)}
                  target="_blank" rel="noopener noreferrer"
                  onClick={() => setMenuOpen(false)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)] transition-colors border-t border-[var(--border-muted)]"
                >
                  <ExternalLink className="h-3.5 w-3.5" /> Open portal
                </a>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Expanded panels */}
      {expanded === 'users' && (
        <UsersPanel
          client={client} users={users} loading={loadingUsers}
          onClose={onClose} onInvite={onInviteUser}
          onResetPassword={onResetPassword} onRemoveUser={onRemoveUser} onLoginAs={onLoginAs}
        />
      )}
      {expanded === 'branding' && (
        <BrandingPanel client={client} onUpdate={onBrandingUpdate} onClose={onClose} />
      )}
      {expanded === 'access' && (
        <AccessPanel
          client={client} staff={staff}
          onClose={onClose} onInvite={onInviteStaff} onToggle={onToggleAccess}
        />
      )}
    </div>
  )
}

// ─── Users Panel ──────────────────────────────────────────────────────────────

function UsersPanel({ client, users, loading, onClose, onInvite, onResetPassword, onRemoveUser, onLoginAs }: {
  client: Client
  users: ClientUser[]
  loading: boolean
  onClose: () => void
  onInvite: () => void
  onResetPassword: (userId: string) => Promise<void>
  onRemoveUser: (userId: string) => Promise<void>
  onLoginAs: (userId: string) => Promise<void>
}) {
  const [resettingId, setResettingId] = useState<string | null>(null)
  const [removingId, setRemovingId]   = useState<string | null>(null)
  const [impersonating, setImpersonating] = useState<string | null>(null)
  const [resetDone, setResetDone] = useState<string | null>(null)

  async function reset(userId: string) {
    setResettingId(userId)
    await onResetPassword(userId)
    setResettingId(null); setResetDone(userId)
    setTimeout(() => setResetDone(null), 2500)
  }
  async function remove(userId: string) { setRemovingId(userId); await onRemoveUser(userId); setRemovingId(null) }
  async function loginLink(userId: string) { setImpersonating(userId); try { await onLoginAs(userId) } finally { setImpersonating(null) } }

  return (
    <div className="border-t border-[var(--border)] bg-[var(--surface-2)] px-5 py-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">Portal users</p>
        <div className="flex items-center gap-2">
          <button onClick={onInvite} className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white bg-[var(--brand)] hover:bg-[var(--brand-hover)] transition-colors">
            <UserPlus className="h-3 w-3" />
            Invite user
          </button>
          <button onClick={onClose} className="text-[var(--text-dim)] hover:text-[var(--text)]"><X className="h-4 w-4" /></button>
        </div>
      </div>
      {loading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-4 w-4 animate-spin text-[var(--brand)]" />
        </div>
      ) : users.length === 0 ? (
        <div className="text-center py-6 rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface)]">
          <Users className="h-5 w-5 text-[var(--text-dim)] mx-auto mb-2" />
          <p className="text-xs text-[var(--text-muted)]">No users yet</p>
          <p className="text-[10px] text-[var(--text-dim)] mt-0.5">Invite a user to give them portal access</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {users.map(user => (
            <div key={user.id} className="flex items-center gap-3 bg-[var(--surface)] rounded-xl px-4 py-2.5 border border-[var(--border)]">
              <div className="h-8 w-8 rounded-full bg-[var(--surface-3)] flex items-center justify-center text-xs font-bold text-[var(--text)] flex-shrink-0">
                {(user.name ?? user.email ?? '?').slice(0, 1).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--text)] truncate">{user.name ?? '—'}</p>
                <p className="text-xs text-[var(--text-muted)] truncate">{user.email}</p>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button
                  onClick={() => loginLink(user.id)}
                  disabled={!!impersonating}
                  title="Preview portal as this user"
                  className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-[var(--text-muted)] border border-[var(--border)] hover:bg-[var(--surface-2)] hover:text-[var(--text)] transition-colors disabled:opacity-40"
                >
                  {impersonating === user.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <LogIn className="h-3 w-3" />}
                  Preview
                </button>
                <button
                  onClick={() => reset(user.id)}
                  disabled={resettingId === user.id}
                  title="Send password reset email"
                  className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-medium border transition-colors disabled:opacity-40 ${
                    resetDone === user.id
                      ? 'border-green-500/30 bg-green-500/10 text-green-400'
                      : 'border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]'
                  }`}
                >
                  {resettingId === user.id ? <Loader2 className="h-3 w-3 animate-spin" /> : resetDone === user.id ? <Check className="h-3 w-3" /> : <KeyRound className="h-3 w-3" />}
                  {resetDone === user.id ? 'Sent' : 'Reset PW'}
                </button>
                <button
                  onClick={() => remove(user.id)}
                  disabled={removingId === user.id}
                  title="Remove user"
                  className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-red-400 border border-red-500/30 hover:bg-red-500/10 transition-colors disabled:opacity-40"
                >
                  {removingId === user.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="mt-3 flex items-center gap-2 rounded-xl bg-[var(--surface)] border border-[var(--border)] px-3 py-2">
        <p className="text-[11px] text-[var(--text-muted)] flex-1 truncate font-mono">{portalUrl(client.slug)}</p>
        <CopyButton text={portalUrl(client.slug)} />
      </div>
    </div>
  )
}

// ─── Branding Panel ───────────────────────────────────────────────────────────

function BrandingPanel({ client, onUpdate, onClose }: { client: Client; onUpdate: (u: Partial<Client>) => void; onClose: () => void }) {
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
    <div className="border-t border-[var(--border)] bg-[var(--surface-2)] px-5 py-4 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">Portal branding</p>
        <button onClick={onClose} className="text-[var(--text-dim)] hover:text-[var(--text)]"><X className="h-4 w-4" /></button>
      </div>
      <div>
        <p className="text-xs font-medium text-[var(--text-muted)] mb-2">Logo</p>
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden border border-[var(--border)]" style={{ backgroundColor: color }}>
            {logoUrl ? <img src={logoUrl} alt="" className="h-full w-full object-contain p-1 brightness-0 invert" /> : <span className="text-white font-bold text-sm">{name.slice(0, 2).toUpperCase()}</span>}
          </div>
          <div className="flex gap-2">
            <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
              className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-2)] transition-colors disabled:opacity-50">
              {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
              {uploading ? 'Uploading…' : logoUrl ? 'Replace' : 'Upload logo'}
            </button>
            {logoUrl && (
              <button onClick={() => setLogoUrl(null)} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/10 transition-colors">Remove</button>
            )}
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) uploadLogo(f) }} />
        </div>
      </div>
      <div>
        <p className="text-xs font-medium text-[var(--text-muted)] mb-1.5">Display name</p>
        <input value={name} onChange={e => setName(e.target.value)}
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-ring)] focus:border-[var(--brand)]" />
      </div>
      <div>
        <p className="text-xs font-medium text-[var(--text-muted)] mb-2">Accent colour</p>
        <div className="flex items-center gap-2 flex-wrap">
          {PRESET_COLORS.map(c => (
            <button key={c} onClick={() => setColor(c)} className={`h-6 w-6 rounded-full border-2 transition-transform hover:scale-110 ${color === c ? 'border-[var(--text)] scale-110' : 'border-transparent'}`} style={{ backgroundColor: c }} />
          ))}
          <input type="color" value={color} onChange={e => setColor(e.target.value)} className="h-6 w-8 cursor-pointer rounded border border-[var(--border)] p-0.5 bg-transparent" />
          <span className="text-xs text-[var(--text-muted)] font-mono">{color}</span>
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <button onClick={onClose} className="rounded-lg px-4 py-2 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-3)] transition-colors">Cancel</button>
        <button onClick={save} disabled={saving} className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold text-white bg-[var(--brand)] hover:bg-[var(--brand-hover)] transition-colors disabled:opacity-50">
          {saved ? <Check className="h-3 w-3" /> : null}
          {saved ? 'Saved' : saving ? 'Saving…' : 'Save branding'}
        </button>
      </div>
    </div>
  )
}

// ─── Access Panel ─────────────────────────────────────────────────────────────

function AccessPanel({ client, staff, onClose, onInvite, onToggle }: {
  client: Client
  staff: StaffMember[]
  onClose: () => void
  onInvite: () => void
  onToggle: (staffId: string, clientId: string, hasAccess: boolean) => Promise<void>
}) {
  const [togglingKey, setTogglingKey] = useState<string | null>(null)

  async function toggleFor(staffId: string, hasAccess: boolean) {
    const key = staffId + client.id
    setTogglingKey(key)
    await onToggle(staffId, client.id, hasAccess)
    setTogglingKey(null)
  }

  return (
    <div className="border-t border-[var(--border)] bg-[var(--surface-2)] px-5 py-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">Team access</p>
          <p className="text-[11px] text-[var(--text-dim)] mt-0.5">Which SwipeUp editors can reach this portal</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onInvite} className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white bg-[var(--brand)] hover:bg-[var(--brand-hover)] transition-colors">
            <UserPlus className="h-3 w-3" />
            Invite editor
          </button>
          <button onClick={onClose} className="text-[var(--text-dim)] hover:text-[var(--text)]"><X className="h-4 w-4" /></button>
        </div>
      </div>
      {staff.length === 0 ? (
        <div className="text-center py-6 rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface)]">
          <UserCog className="h-5 w-5 text-[var(--text-dim)] mx-auto mb-2" />
          <p className="text-xs text-[var(--text-muted)]">No team members yet</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {staff.map(member => {
            const hasAccess = member.clientIds.includes(client.id)
            const key = member.id + client.id
            const toggling = togglingKey === key
            return (
              <div key={member.id} className="flex items-center gap-3 bg-[var(--surface)] rounded-xl px-4 py-2.5 border border-[var(--border)]">
                <div className="h-8 w-8 rounded-full bg-[var(--surface-3)] flex items-center justify-center text-xs font-bold text-[var(--text)] flex-shrink-0">
                  {(member.name ?? member.email ?? '?').slice(0, 1).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--text)] truncate">{member.name ?? '—'}</p>
                  <p className="text-xs text-[var(--text-muted)] truncate">{member.email}</p>
                </div>
                <button
                  onClick={() => toggleFor(member.id, hasAccess)}
                  disabled={toggling}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all disabled:opacity-50 ${
                    hasAccess
                      ? 'bg-green-500/10 text-green-400 border border-green-500/30 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30'
                      : 'bg-[var(--surface-2)] text-[var(--text-muted)] border border-[var(--border)] hover:bg-[var(--brand-soft)] hover:text-[var(--brand)] hover:border-[var(--brand)]'
                  }`}
                >
                  {toggling ? <Loader2 className="h-3 w-3 animate-spin" /> : hasAccess ? <><Check className="h-3 w-3" /> Access granted</> : <>+ Grant access</>}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Copy Button ──────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  function copy() { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000) }
  return (
    <button onClick={copy} className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-2)] transition-colors flex-shrink-0">
      {copied ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
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
    <ModalShell onClose={onClose}>
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: client.color }}>
            {client.name.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <h2 className="font-bold text-[var(--text)] text-sm">Invite user</h2>
            <p className="text-xs text-[var(--text-muted)]">{client.name}</p>
          </div>
        </div>
        <button onClick={onClose} className="rounded-lg p-1 text-[var(--text-dim)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]"><X className="h-5 w-5" /></button>
      </div>
      {!done ? (
        <div className="space-y-3">
          <FormInput label="Name" value={name} onChange={setName} placeholder="e.g. Sarah Johnson" />
          <FormInput label="Email *" type="email" value={email} onChange={setEmail} placeholder="sarah@brand.com" />
          {error && <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-2">{error}</p>}
          <PrimaryButton onClick={sendInvite} disabled={inviting || !email.trim()}>
            {inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
            {inviting ? 'Sending…' : 'Send invite'}
          </PrimaryButton>
        </div>
      ) : (
        <div className="text-center space-y-4">
          <div className="h-12 w-12 rounded-full bg-green-500/10 flex items-center justify-center mx-auto">
            <CheckCircle2 className="h-6 w-6 text-green-400" />
          </div>
          <div>
            <p className="font-semibold text-[var(--text)]">Invite sent</p>
            <p className="text-sm text-[var(--text-muted)] mt-1">{email}</p>
          </div>
          <div className="rounded-xl bg-[var(--surface-2)] border border-[var(--border)] p-3">
            <p className="text-xs text-[var(--text-muted)] mb-2 font-medium">Their portal URL</p>
            <div className="flex items-center gap-2">
              <p className="text-[11px] text-[var(--text-muted)] flex-1 truncate font-mono">{portalUrl(client.slug)}</p>
              <CopyButton text={portalUrl(client.slug)} />
            </div>
          </div>
          <PrimaryButton onClick={onDone}>Done</PrimaryButton>
        </div>
      )}
    </ModalShell>
  )
}

// ─── New Client Modal ─────────────────────────────────────────────────────────

function NewClientModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [step, setStep] = useState<'details' | 'invite' | 'done'>('details')
  const [name, setName]   = useState('')
  const [slug, setSlug]   = useState('')
  const [color, setColor] = useState('#4950F8')
  const [hasShopify, setHasShopify] = useState(false)
  const [hasVans, setHasVans]       = useState(false)
  const [savingClient, setSavingClient]       = useState(false)
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

  return (
    <ModalShell onClose={onClose} maxWidth="max-w-md">
      <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--border-muted)] -mx-6 -mt-6 mb-6">
        <div>
          <h2 className="font-bold text-[var(--text)]">
            {step === 'details' ? 'New client' : step === 'invite' ? 'Invite user' : 'All done'}
          </h2>
          <div className="flex items-center gap-1.5 mt-2">
            {(['details', 'invite', 'done'] as const).map((s, i) => (
              <div key={s} className={`h-1 w-8 rounded-full transition-colors ${
                s === step ? 'bg-[var(--brand)]' : i < ['details','invite','done'].indexOf(step) ? 'bg-[var(--brand)]/40' : 'bg-[var(--surface-3)]'
              }`} />
            ))}
          </div>
        </div>
        <button onClick={onClose} className="rounded-lg p-1 text-[var(--text-dim)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]"><X className="h-5 w-5" /></button>
      </div>
      {step === 'details' && (
        <div className="space-y-4">
          <FormInput label="Client name *" value={name} onChange={handleNameChange} placeholder="e.g. Blended Hair Fibres" />
          <div>
            <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide block mb-1.5">Portal subdomain *</label>
            <div className="flex items-center rounded-xl border border-[var(--border)] bg-[var(--surface-2)] overflow-hidden focus-within:ring-2 focus-within:ring-[var(--brand-ring)] focus-within:border-[var(--brand)]">
              <input type="text" value={slug} onChange={e => setSlug(e.target.value)} placeholder="bhf"
                className="flex-1 px-3 py-2.5 text-sm text-[var(--text)] placeholder:text-[var(--text-dim)] bg-transparent focus:outline-none" />
              <span className="px-3 py-2.5 text-sm text-[var(--text-muted)] bg-[var(--surface-3)] border-l border-[var(--border)] whitespace-nowrap">.portal.swipeupco.com</span>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide block mb-2">Accent colour</label>
            <div className="flex flex-wrap gap-2">
              {PRESET_COLORS.map(c => (
                <button key={c} type="button" onClick={() => setColor(c)}
                  className={`h-7 w-7 rounded-full border-2 transition-transform hover:scale-110 ${color === c ? 'border-[var(--text)] scale-110' : 'border-transparent'}`}
                  style={{ backgroundColor: c }} />
              ))}
              <input type="color" value={color} onChange={e => setColor(e.target.value)} className="h-7 w-7 rounded-full border-2 border-[var(--border)] cursor-pointer bg-transparent" />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide block mb-2">Features</label>
            <div className="space-y-2">
              <FeatureToggle checked={hasShopify} onChange={setHasShopify} icon={Store} label="Shopify integration" description="Shows Shopify tab in their portal" />
              <FeatureToggle checked={hasVans} onChange={setHasVans} icon={Truck} label="Caravan / van inventory" description="Enables Shows, Shoots & Inventory tabs" />
            </div>
          </div>
          <PrimaryButton onClick={saveNewClient} disabled={savingClient || !name.trim() || !slug.trim()}>
            {savingClient ? 'Creating…' : 'Create client →'}
          </PrimaryButton>
        </div>
      )}
      {step === 'invite' && (
        <div className="space-y-4">
          <div className="rounded-xl bg-green-500/10 border border-green-500/30 p-3 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-400 flex-shrink-0" />
            <p className="text-sm text-green-400 font-medium">Client created. Invite their first user.</p>
          </div>
          <FormInput label="Contact name" value={inviteName} onChange={setInviteName} placeholder="e.g. Sarah Johnson" />
          <FormInput label="Email address *" type="email" value={inviteEmail} onChange={setInviteEmail} placeholder="sarah@brand.com" />
          {inviteError && <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">{inviteError}</p>}
          <div className="flex gap-2">
            <button onClick={onCreated} className="flex-1 rounded-xl py-2.5 text-sm font-medium text-[var(--text-muted)] border border-[var(--border)] hover:bg-[var(--surface-2)] hover:text-[var(--text)] transition-colors">Skip</button>
            <button onClick={sendInvite} disabled={inviting || !inviteEmail.trim()}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-white bg-[var(--brand)] hover:bg-[var(--brand-hover)] disabled:opacity-50 transition-colors">
              {inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              {inviting ? 'Sending…' : 'Send invite'}
            </button>
          </div>
        </div>
      )}
      {step === 'done' && (
        <div className="text-center py-4 space-y-4">
          <div className="h-14 w-14 rounded-full bg-green-500/10 flex items-center justify-center mx-auto">
            <CheckCircle2 className="h-7 w-7 text-green-400" />
          </div>
          <div>
            <h3 className="font-bold text-[var(--text)] text-lg">All done</h3>
            <p className="text-sm text-[var(--text-muted)] mt-1">Invite sent to <span className="font-medium text-[var(--text)]">{inviteEmail}</span></p>
          </div>
          <div className="text-left rounded-xl bg-[var(--surface-2)] border border-[var(--border)] p-4">
            <p className="text-xs font-semibold text-[var(--text-muted)] mb-2">Their portal URL</p>
            <div className="flex items-center gap-2">
              <p className="text-[11px] text-[var(--text-muted)] flex-1 truncate font-mono">{portalUrl(createdSlug)}</p>
              <CopyButton text={portalUrl(createdSlug)} />
            </div>
          </div>
          <PrimaryButton onClick={onCreated}>Back to clients</PrimaryButton>
        </div>
      )}
    </ModalShell>
  )
}

// ─── Invite Staff Modal ───────────────────────────────────────────────────────

function InviteStaffModal({ onClose, onDone }: { onClose: () => void; onDone: (member: StaffMember) => void }) {
  const [email, setEmail] = useState('')
  const [name, setName]   = useState('')
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
    setNewMember(member); setDone(true)
  }

  return (
    <ModalShell onClose={onClose}>
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-[var(--brand)] flex items-center justify-center">
            <UserCog className="h-4 w-4 text-white" />
          </div>
          <div>
            <h2 className="font-bold text-[var(--text)] text-sm">Add team member</h2>
            <p className="text-xs text-[var(--text-muted)]">SwipeUp editor — invite only</p>
          </div>
        </div>
        <button onClick={onClose} className="rounded-lg p-1 text-[var(--text-dim)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]"><X className="h-5 w-5" /></button>
      </div>
      {!done ? (
        <div className="space-y-3">
          <FormInput label="Name" value={name} onChange={setName} placeholder="e.g. Jordan Smith" />
          <FormInput label="Email *" type="email" value={email} onChange={setEmail} placeholder="jordan@swipeupco.com" />
          <p className="text-[11px] text-[var(--text-muted)] bg-[var(--surface-2)] rounded-lg px-3 py-2">
            They&apos;ll receive an invite email and log in at portal.swipeupco.com. You can then grant them access to specific clients.
          </p>
          {error && <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-2">{error}</p>}
          <PrimaryButton onClick={sendInvite} disabled={inviting || !email.trim()}>
            {inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
            {inviting ? 'Sending…' : 'Send invite'}
          </PrimaryButton>
        </div>
      ) : (
        <div className="text-center space-y-4">
          <div className="h-12 w-12 rounded-full bg-green-500/10 flex items-center justify-center mx-auto">
            <CheckCircle2 className="h-6 w-6 text-green-400" />
          </div>
          <div>
            <p className="font-semibold text-[var(--text)]">Invite sent to {email}</p>
            <p className="text-sm text-[var(--text-muted)] mt-1">Now grant them access to specific client portals.</p>
          </div>
          <PrimaryButton onClick={() => newMember && onDone(newMember)}>Done</PrimaryButton>
        </div>
      )}
    </ModalShell>
  )
}

// ─── Shared primitives ────────────────────────────────────────────────────────

function ModalShell({ children, onClose, maxWidth = 'max-w-sm' }: { children: React.ReactNode; onClose: () => void; maxWidth?: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className={`relative bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-2xl w-full ${maxWidth} p-6`}>
        {children}
      </div>
    </div>
  )
}

function FormInput({ label, value, onChange, placeholder, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <div>
      <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide block mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 text-sm text-[var(--text)] placeholder:text-[var(--text-dim)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-ring)] focus:border-[var(--brand)]"
      />
    </div>
  )
}

function PrimaryButton({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-white bg-[var(--brand)] hover:bg-[var(--brand-hover)] disabled:opacity-50 transition-colors"
    >
      {children}
    </button>
  )
}

function FeatureToggle({ checked, onChange, icon: Icon, label, description }: {
  checked: boolean
  onChange: (v: boolean) => void
  icon: typeof Store
  label: string
  description: string
}) {
  return (
    <label className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3 cursor-pointer hover:bg-[var(--surface-3)] transition-colors">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="accent-[var(--brand)]" />
      <Icon className="h-4 w-4 text-[var(--text-muted)]" />
      <div>
        <p className="text-sm font-medium text-[var(--text)]">{label}</p>
        <p className="text-xs text-[var(--text-muted)]">{description}</p>
      </div>
    </label>
  )
}
