'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import {
  ArrowRight, ChevronDown, LogIn, Loader2, Plus, X,
  CheckCircle2, Mail, Palette, Store, Truck, Package,
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

const STAGES = [
  { key: 'backlog',       label: 'Backlog',       bg: 'bg-zinc-100',   text: 'text-zinc-600' },
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

export default function ClientsOverview() {
  const [clients, setClients]   = useState<Client[]>([])
  const [counts, setCounts]     = useState<Record<string, BriefCounts>>({})
  const [loading, setLoading]   = useState(true)
  const [showNewClient, setShowNewClient] = useState(false)

  // Impersonation state
  const [openDropdown, setOpenDropdown]   = useState<string | null>(null)
  const [clientUsers, setClientUsers]     = useState<Record<string, ClientUser[]>>({})
  const [loadingUsers, setLoadingUsers]   = useState<string | null>(null)
  const [impersonating, setImpersonating] = useState<string | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

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
    if (openDropdown === clientId) { setOpenDropdown(null); return }
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
      if (json.link) window.open(json.link, '_blank')
      else alert(json.error ?? 'Failed to generate login link')
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
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Clients</h1>
          <p className="text-sm text-zinc-500 mt-1">{clients.length} clients · {totalActive} active briefs</p>
        </div>
        <button
          onClick={() => setShowNewClient(true)}
          className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white bg-[#14C29F] hover:opacity-90 transition-opacity"
        >
          <Plus className="h-4 w-4" />
          New Client
        </button>
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
            <div key={client.id} className="bg-white rounded-2xl border border-zinc-200 p-6 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-4">
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

                <div className="flex items-center gap-2 flex-shrink-0">
                  {/* Login as dropdown */}
                  <div className="relative">
                    <button
                      onClick={() => toggleDropdown(client.id)}
                      className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium border border-zinc-200 text-zinc-600 hover:bg-zinc-50 transition-colors"
                    >
                      {isFetchingUsers ? <Loader2 className="h-3 w-3 animate-spin" /> : <LogIn className="h-3 w-3" />}
                      Login as
                      <ChevronDown className={`h-3 w-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {isOpen && (
                      <div className="absolute right-0 top-full mt-1.5 z-20 min-w-[200px] rounded-xl border border-zinc-200 bg-white shadow-lg py-1">
                        {users.length === 0 ? (
                          <p className="px-4 py-2.5 text-xs text-zinc-400">No users — invite one first</p>
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
                              {impersonating === u.id && <Loader2 className="h-3 w-3 animate-spin text-zinc-400 ml-auto flex-shrink-0" />}
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => router.push(`/pipeline/${client.slug}`)}
                    className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white"
                    style={{ backgroundColor: client.color }}
                  >
                    View pipeline
                    <ArrowRight className="h-3 w-3" />
                  </button>
                </div>
              </div>

              {/* Stage pills */}
              <div className="flex gap-2 mt-4 flex-wrap">
                {STAGES.map(stage => (
                  <div key={stage.key} className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${stage.bg} ${stage.text}`}>
                    <span>{stage.label}</span>
                    <span className="font-bold">{c[stage.key as keyof BriefCounts]}</span>
                  </div>
                ))}
              </div>

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

      {/* New Client Modal */}
      {showNewClient && (
        <NewClientModal
          onClose={() => setShowNewClient(false)}
          onCreated={() => { setShowNewClient(false); load() }}
        />
      )}
    </div>
  )
}

// ─── New Client Modal ─────────────────────────────────────────────────────────

function NewClientModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [step, setStep] = useState<'details' | 'invite' | 'done'>('details')

  // Step 1 — client details
  const [name, setName]               = useState('')
  const [slug, setSlug]               = useState('')
  const [color, setColor]             = useState('#14C29F')
  const [hasShopify, setHasShopify]   = useState(false)
  const [hasVans, setHasVans]         = useState(false)
  const [productsLabel, setProductsLabel] = useState('Products')
  const [savingClient, setSavingClient]   = useState(false)
  const [createdClientId, setCreatedClientId] = useState<string | null>(null)

  // Step 2 — invite
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName, setInviteName]   = useState('')
  const [inviting, setInviting]       = useState(false)
  const [inviteError, setInviteError] = useState<string | null>(null)

  function handleNameChange(val: string) {
    setName(val)
    setSlug(slugify(val))
  }

  async function createClient() {
    if (!name.trim() || !slug.trim()) return
    setSavingClient(true)
    const supabase = createClient()
    const { data, error } = await supabase
      .from('clients')
      .insert({
        name:           name.trim(),
        slug:           slug.trim(),
        color,
        has_shopify:    hasShopify,
        has_vans:       hasVans,
        products_label: hasVans ? 'Inventory' : productsLabel,
        logo_url:       null,
      })
      .select('id')
      .single()

    setSavingClient(false)
    if (error) { alert(error.message); return }
    setCreatedClientId(data.id)
    setStep('invite')
  }

  async function sendInvite() {
    if (!inviteEmail.trim() || !createdClientId) return
    setInviting(true)
    setInviteError(null)
    const res = await fetch('/api/invite-client', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: createdClientId, email: inviteEmail.trim(), name: inviteName.trim() || null }),
    })
    const json = await res.json()
    setInviting(false)
    if (json.error) { setInviteError(json.error); return }
    setStep('done')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-100">
          <div>
            <h2 className="font-bold text-zinc-900">
              {step === 'details' ? 'New Client' : step === 'invite' ? 'Invite Client User' : 'Client Created'}
            </h2>
            <div className="flex items-center gap-2 mt-2">
              {(['details', 'invite', 'done'] as const).map((s, i) => (
                <div key={s} className="flex items-center gap-2">
                  <div className={`h-2 w-2 rounded-full transition-colors ${
                    step === s ? 'bg-[#14C29F]' : i < ['details','invite','done'].indexOf(step) ? 'bg-zinc-300' : 'bg-zinc-200'
                  }`} />
                </div>
              ))}
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6">

          {/* ── Step 1: Client Details ── */}
          {step === 'details' && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-zinc-600 uppercase tracking-wide block mb-1.5">Client Name *</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => handleNameChange(e.target.value)}
                  placeholder="e.g. Blended Hair Fibres"
                  className="w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:border-[#14C29F] focus:ring-[#14C29F]/20"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-600 uppercase tracking-wide block mb-1.5">URL Slug *</label>
                <div className="flex items-center rounded-xl border border-zinc-200 overflow-hidden focus-within:ring-2 focus-within:ring-[#14C29F]/20 focus-within:border-[#14C29F]">
                  <span className="px-3 py-2.5 text-sm text-zinc-400 bg-zinc-50 border-r border-zinc-200">/pipeline/</span>
                  <input
                    type="text"
                    value={slug}
                    onChange={e => setSlug(e.target.value)}
                    placeholder="blended-hair-fibres"
                    className="flex-1 px-3 py-2.5 text-sm focus:outline-none"
                  />
                </div>
              </div>

              {/* Accent colour */}
              <div>
                <label className="text-xs font-semibold text-zinc-600 uppercase tracking-wide block mb-2">Accent Colour</label>
                <div className="flex flex-wrap gap-2">
                  {PRESET_COLORS.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={`h-7 w-7 rounded-full border-2 transition-transform hover:scale-110 ${color === c ? 'border-zinc-900 scale-110' : 'border-transparent'}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                  <input
                    type="color"
                    value={color}
                    onChange={e => setColor(e.target.value)}
                    className="h-7 w-7 rounded-full border-2 border-zinc-200 cursor-pointer"
                    title="Custom colour"
                  />
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <div className="h-4 w-4 rounded-full" style={{ backgroundColor: color }} />
                  <span className="text-xs text-zinc-500">{color}</span>
                </div>
              </div>

              {/* Feature toggles */}
              <div>
                <label className="text-xs font-semibold text-zinc-600 uppercase tracking-wide block mb-2">Features</label>
                <div className="space-y-2">
                  <label className="flex items-center gap-3 rounded-xl border border-zinc-200 px-4 py-3 cursor-pointer hover:bg-zinc-50">
                    <input type="checkbox" checked={hasShopify} onChange={e => setHasShopify(e.target.checked)} className="rounded" />
                    <Store className="h-4 w-4 text-zinc-500" />
                    <div>
                      <p className="text-sm font-medium text-zinc-800">Shopify Integration</p>
                      <p className="text-xs text-zinc-400">Shows Shopify tab in their portal</p>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 rounded-xl border border-zinc-200 px-4 py-3 cursor-pointer hover:bg-zinc-50">
                    <input type="checkbox" checked={hasVans} onChange={e => setHasVans(e.target.checked)} className="rounded" />
                    <Truck className="h-4 w-4 text-zinc-500" />
                    <div>
                      <p className="text-sm font-medium text-zinc-800">Caravan / Van Inventory</p>
                      <p className="text-xs text-zinc-400">Routes to /inventory instead of /products</p>
                    </div>
                  </label>
                  {!hasVans && (
                    <div className="flex items-center gap-3 rounded-xl border border-zinc-200 px-4 py-3">
                      <Package className="h-4 w-4 text-zinc-500 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-zinc-800 mb-1">Products Tab Label</p>
                        <input
                          type="text"
                          value={productsLabel}
                          onChange={e => setProductsLabel(e.target.value)}
                          placeholder="Products"
                          className="w-full rounded-lg border border-zinc-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-[#14C29F]/30"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Preview */}
              <div className="rounded-xl border border-zinc-200 p-3 bg-zinc-50">
                <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wide mb-2">Preview</p>
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg flex items-center justify-center text-white font-bold text-xs" style={{ backgroundColor: color }}>
                    {name ? name.slice(0, 2).toUpperCase() : 'CL'}
                  </div>
                  <span className="text-sm font-semibold text-zinc-800">{name || 'Client Name'}</span>
                </div>
              </div>

              <button
                onClick={createClient}
                disabled={savingClient || !name.trim() || !slug.trim()}
                className="w-full rounded-xl py-2.5 text-sm font-semibold text-white bg-[#14C29F] disabled:opacity-50 hover:opacity-90 transition-opacity"
              >
                {savingClient ? 'Creating…' : 'Create Client →'}
              </button>
            </div>
          )}

          {/* ── Step 2: Invite User ── */}
          {step === 'invite' && (
            <div className="space-y-4">
              <div className="rounded-xl bg-green-50 border border-green-100 p-3 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                <p className="text-sm text-green-700 font-medium">Client created! Now invite their team member.</p>
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-600 uppercase tracking-wide block mb-1.5">Contact Name</label>
                <input
                  type="text"
                  value={inviteName}
                  onChange={e => setInviteName(e.target.value)}
                  placeholder="e.g. Sarah Johnson"
                  className="w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:border-[#14C29F] focus:ring-[#14C29F]/20"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-600 uppercase tracking-wide block mb-1.5">Email Address *</label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  placeholder="sarah@clientbrand.com"
                  className="w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:border-[#14C29F] focus:ring-[#14C29F]/20"
                />
                <p className="text-xs text-zinc-400 mt-1.5">They'll receive an email to set up their account and access their portal.</p>
              </div>

              {inviteError && (
                <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3">
                  <p className="text-sm text-red-700">{inviteError}</p>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => { onCreated() }}
                  className="flex-1 rounded-xl py-2.5 text-sm font-medium text-zinc-600 border border-zinc-200 hover:bg-zinc-50 transition-colors"
                >
                  Skip for now
                </button>
                <button
                  onClick={sendInvite}
                  disabled={inviting || !inviteEmail.trim()}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-white bg-[#14C29F] disabled:opacity-50 hover:opacity-90 transition-opacity"
                >
                  {inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                  {inviting ? 'Sending…' : 'Send Invite'}
                </button>
              </div>
            </div>
          )}

          {/* ── Step 3: Done ── */}
          {step === 'done' && (
            <div className="text-center py-4 space-y-4">
              <div className="h-14 w-14 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                <CheckCircle2 className="h-7 w-7 text-green-600" />
              </div>
              <div>
                <h3 className="font-bold text-zinc-900 text-lg">All done!</h3>
                <p className="text-sm text-zinc-500 mt-1">
                  Invite sent to <span className="font-medium text-zinc-700">{inviteEmail}</span>.
                  They'll receive an email to set up their account.
                </p>
              </div>
              <p className="text-xs text-zinc-400 bg-zinc-50 rounded-xl p-3">
                Once they accept, their account will be automatically linked to this client's workspace. They won't be able to see any other clients.
              </p>
              <button
                onClick={onCreated}
                className="w-full rounded-xl py-2.5 text-sm font-semibold text-white bg-[#14C29F] hover:opacity-90 transition-opacity"
              >
                Back to Clients
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
