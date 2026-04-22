'use client'

import React, { useEffect, useState, use, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, ExternalLink, Plus, X, Loader2, Video, Image as ImageIcon, Mail, LayoutGrid, Mic, FileText, CircleDot, MessageSquare, CalendarDays, User } from 'lucide-react'
import { BriefDrawer } from '@/components/pipeline/BriefDrawer'
import { updateBriefStatus } from '@/lib/pipeline/updateBriefStatus'

interface Client { id: string; name: string; slug: string; color: string; logo_url: string | null }

interface Brief {
  id: string
  name: string
  description: string | null
  campaign: string | null
  content_type: string | null
  pipeline_status: string
  internal_status: string | null
  draft_url: string | null
  due_date: string | null
  client_id: string
  cover_url?: string | null
  assigned_to?: string | null
  assigned_designer_name?: string | null
  assigned_designer_avatar?: string | null
  assigned_designer_id?: string | null
}

interface StaffLite { id: string; name: string | null; avatar_url: string | null; email: string | null }

const CONTENT_TYPES = ['Video', 'Graphic', 'EDM', 'Signage', 'Voiceover', 'Script', 'Other']
const TYPE_ICON: Record<string, typeof Video> = {
  Video, Graphic: ImageIcon, EDM: Mail, Signage: LayoutGrid,
  Voiceover: Mic, Script: FileText, Other: CircleDot,
}

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'portal.swipeupco.com'

// Hub client-board columns: 4 stages. Revisions is handled as a badge on the
// In Production card, not as its own column (per Task 3 brief).
const COLUMNS: Array<{ key: string; label: string; matches: (b: Brief) => boolean }> = [
  { key: 'backlog',          label: 'Backlog',          matches: b => b.pipeline_status === 'backlog' },
  { key: 'in_production',    label: 'In Production',    matches: b => b.pipeline_status === 'in_production' || b.pipeline_status === 'qa_review' },
  { key: 'ready_for_review', label: 'Ready for Review', matches: b => b.pipeline_status === 'client_review' },
  { key: 'approved',         label: 'Approved',         matches: b => b.pipeline_status === 'approved' },
]

// Map a Hub column key back to a pipeline_status for DB writes
const HUB_COL_TO_STATUS: Record<string, string> = {
  backlog: 'backlog',
  in_production: 'in_production',
  ready_for_review: 'client_review',
  approved: 'approved',
}

export default function ClientPipeline({ params }: { params: Promise<{ clientSlug: string }> }) {
  const { clientSlug } = use(params)
  const searchParams = useSearchParams()
  const highlightCol = searchParams.get('col')

  const [client, setClient]   = useState<Client | null>(null)
  const [briefs, setBriefs]   = useState<Brief[]>([])
  const [staff, setStaff]     = useState<StaffLite[]>([])
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [selectedBrief, setSelectedBrief] = useState<Brief | null>(null)
  const [showNewBrief, setShowNewBrief]   = useState(false)
  const router = useRouter()

  async function load() {
    const supabase = createClient()
    const { data: clientData } = await supabase
      .from('clients').select('*').eq('slug', clientSlug).single()
    if (!clientData) { setLoading(false); return }
    setClient(clientData)

    const [{ data: briefData }, { data: staffData }] = await Promise.all([
      supabase.from('briefs').select('*')
        .eq('client_id', clientData.id)
        .order('pos', { ascending: true }),
      supabase.from('profiles')
        .select('id, name, avatar_url, email')
        .or('hub_role.eq.admin,hub_role.eq.designer,is_staff.eq.true,is_admin.eq.true'),
    ])
    const staffList = (staffData as StaffLite[]) ?? []
    setStaff(staffList)

    // Join assignee profile on the brief row
    const hydrated = (briefData ?? []).map((b: Record<string, unknown>) => {
      const assignee = staffList.find(s => s.id === b.assigned_to)
      return {
        ...b,
        assigned_designer_id:     (b.assigned_to as string | null) ?? null,
        assigned_designer_name:   assignee?.name ?? null,
        assigned_designer_avatar: assignee?.avatar_url ?? null,
      } as Brief
    })
    setBriefs(hydrated)

    // Comment counts — one fetch for the whole board
    const ids = hydrated.map(b => b.id)
    if (ids.length) {
      const { data: counts } = await supabase
        .from('brief_comments')
        .select('brief_id')
        .in('brief_id', ids)
      const map: Record<string, number> = {}
      counts?.forEach((c: { brief_id: string }) => {
        map[c.brief_id] = (map[c.brief_id] ?? 0) + 1
      })
      setCommentCounts(map)
    } else {
      setCommentCounts({})
    }
    setLoading(false)
  }

  async function assignDesigner(briefId: string, staffId: string | null) {
    const supabase = createClient()
    await supabase.from('briefs').update({ assigned_to: staffId }).eq('id', briefId)
    const assignee = staffId ? staff.find(s => s.id === staffId) : null
    setBriefs(prev => prev.map(b => b.id === briefId ? {
      ...b,
      assigned_to: staffId,
      assigned_designer_id: staffId,
      assigned_designer_name:   assignee?.name ?? null,
      assigned_designer_avatar: assignee?.avatar_url ?? null,
    } : b))
    if (selectedBrief?.id === briefId) {
      setSelectedBrief(prev => prev ? { ...prev, assigned_to: staffId } : null)
    }
  }

  useEffect(() => {
    load()
    const supabase = createClient()
    const channel = supabase
      .channel(`briefs-client-${clientSlug}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'briefs' }, () => load())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientSlug])

  async function moveToColumn(briefId: string, columnKey: string) {
    const newStatus = HUB_COL_TO_STATUS[columnKey]
    if (!newStatus) return
    // Optimistic
    setBriefs(prev => prev.map(b => b.id === briefId ? { ...b, pipeline_status: newStatus } : b))
    if (selectedBrief?.id === briefId) setSelectedBrief(prev => prev ? { ...prev, pipeline_status: newStatus } : null)
    const updates = await updateBriefStatus(briefId, { pipeline_status: newStatus })
    setBriefs(prev => prev.map(b => b.id === briefId ? { ...b, ...updates } : b))
    if (selectedBrief?.id === briefId) setSelectedBrief(prev => prev ? { ...prev, ...updates } : null)
  }

  const grouped = useMemo(() => {
    const out: Record<string, Brief[]> = {}
    for (const col of COLUMNS) out[col.key] = briefs.filter(col.matches)
    return out
  }, [briefs])

  if (loading) return (
    <div className="flex items-center justify-center h-[60vh]">
      <Loader2 className="h-6 w-6 animate-spin text-[var(--brand)]" />
    </div>
  )
  if (!client) return <div className="p-8 text-[var(--text-muted)]">Client not found.</div>

  const portalUrl = `https://${client.slug}.${ROOT_DOMAIN}`

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-[var(--surface)] border-b border-[var(--border)] flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => router.push('/')}
            aria-label="Back to All Clients"
            className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)] transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div
            className="h-9 w-9 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0 overflow-hidden"
            style={{ backgroundColor: client.color }}
          >
            {client.logo_url
              ? <img src={client.logo_url} alt="" className="h-full w-full object-contain p-1 brightness-0 invert" />
              : client.name.slice(0, 2).toUpperCase()
            }
          </div>
          <div className="min-w-0">
            <h1 className="font-semibold text-[var(--text)] text-base truncate">{client.name}</h1>
            <p className="text-xs text-[var(--text-muted)]">{briefs.length} {briefs.length === 1 ? 'brief' : 'briefs'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <a
            href={portalUrl} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-muted)] hover:bg-[var(--surface-3)] hover:text-[var(--text)] transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Client portal
          </a>
          <button
            onClick={() => setShowNewBrief(true)}
            className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold text-white bg-[var(--brand)] hover:bg-[var(--brand-hover)] transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            New brief
          </button>
        </div>
      </div>

      {/* Kanban board */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden bg-[var(--bg)]">
        <div className="flex h-full gap-3 min-w-max p-4">
          {COLUMNS.map(col => {
            const colBriefs = grouped[col.key] ?? []
            const highlighted = highlightCol === col.key
            return (
              <div
                key={col.key}
                className={`flex flex-col w-80 h-full rounded-2xl border bg-[var(--surface)] ${
                  highlighted ? 'border-[var(--brand)] ring-2 ring-[var(--brand-ring)]' : 'border-[var(--border)]'
                }`}
              >
                <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-muted)] flex-shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">{col.label}</span>
                    <span className="text-[11px] font-bold rounded-full px-2 py-0.5 bg-[var(--surface-2)] text-[var(--text)]">
                      {colBriefs.length}
                    </span>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                  {colBriefs.map(brief => (
                    <HubBriefCard
                      key={brief.id}
                      brief={brief}
                      staff={staff}
                      commentCount={commentCounts[brief.id] ?? 0}
                      clientColor={client.color}
                      onClick={() => setSelectedBrief(brief)}
                      onAssign={(uid) => assignDesigner(brief.id, uid)}
                    />
                  ))}
                  {colBriefs.length === 0 && (
                    <div className="flex items-center justify-center h-16 rounded-xl border border-dashed border-[var(--border)]">
                      <p className="text-xs text-[var(--text-dim)]">Empty</p>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Brief drawer */}
      {selectedBrief && (
        <BriefDrawer
          brief={selectedBrief}
          clientColor={client.color}
          clientName={client.name}
          internalMode
          onClose={() => setSelectedBrief(null)}
          onMove={(id, stage) => {
            // BriefDrawer calls this with a pipeline_status; map it back to column keys for our grouping
            const colKey = Object.entries(HUB_COL_TO_STATUS).find(([, v]) => v === stage)?.[0] ?? 'in_production'
            moveToColumn(id, colKey)
          }}
          onInternalMove={async (id, stage) => {
            const supabase = createClient()
            await supabase.from('briefs').update({ internal_status: stage }).eq('id', id)
          }}
          onRefresh={load}
          onBriefUpdate={(updates) => {
            setBriefs(prev => prev.map(b => b.id === selectedBrief.id ? { ...b, ...updates } : b))
            setSelectedBrief(prev => prev ? { ...prev, ...updates } : null)
          }}
        />
      )}

      {/* New brief modal */}
      {showNewBrief && client && (
        <CreateBriefModal
          clientId={client.id}
          clientColor={client.color}
          clientName={client.name}
          onClose={() => setShowNewBrief(false)}
          onCreated={() => { setShowNewBrief(false); load() }}
        />
      )}
    </div>
  )
}

// ─── Brief Card (Hub) ─────────────────────────────────────────────────────────

function HubBriefCard({ brief, staff, commentCount, clientColor, onClick, onAssign }: {
  brief: Brief
  staff: StaffLite[]
  commentCount: number
  clientColor: string
  onClick: () => void
  onAssign: (staffId: string | null) => void
}) {
  const TypeIcon = brief.content_type ? (TYPE_ICON[brief.content_type] ?? CircleDot) : null
  const isRevisions = brief.internal_status === 'revisions_required'
  const hasDraft = !!brief.draft_url

  return (
    <div
      onClick={onClick}
      className="group w-full text-left rounded-xl border border-[var(--border)] bg-[var(--surface-2)] hover:bg-[var(--surface-3)] hover:border-[var(--brand-soft)] transition-colors overflow-hidden cursor-pointer"
    >
      {/* Left accent stripe in client color */}
      <div className="flex">
        <div className="w-1 flex-shrink-0" style={{ backgroundColor: clientColor }} />
        <div className="flex-1 p-3 space-y-2 min-w-0">
          {brief.campaign && (
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-dim)] truncate">{brief.campaign}</p>
          )}
          <p className="text-sm font-semibold text-[var(--text)] leading-snug line-clamp-2">{brief.name}</p>

          <div className="flex items-center gap-1.5 flex-wrap">
            {brief.content_type && TypeIcon && (
              <span className="flex items-center gap-1 text-[10px] font-medium rounded-full px-2 py-0.5 bg-[var(--surface)] border border-[var(--border)] text-[var(--text-muted)]">
                <TypeIcon className="h-3 w-3" />
                {brief.content_type}
              </span>
            )}
            {isRevisions && (
              <span className="text-[10px] font-semibold rounded-full px-2 py-0.5 bg-red-500/10 border border-red-500/30 text-red-400">
                Revisions
              </span>
            )}
            {hasDraft && !isRevisions && (
              <span className="text-[10px] font-semibold rounded-full px-2 py-0.5 bg-[var(--brand-soft)] border border-[var(--brand)]/30 text-[var(--brand)]">
                Draft ready
              </span>
            )}
          </div>

          <div className="flex items-center justify-between gap-2 pt-1 border-t border-[var(--border-muted)]">
            {/* Left: due date + comment count */}
            <div className="flex items-center gap-2 text-[10px] text-[var(--text-dim)] min-w-0">
              {brief.due_date && (
                <span className="flex items-center gap-1">
                  <CalendarDays className="h-3 w-3" />
                  {new Date(brief.due_date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
                </span>
              )}
              {commentCount > 0 && (
                <span className="flex items-center gap-1">
                  <MessageSquare className="h-3 w-3" />
                  {commentCount}
                </span>
              )}
            </div>
            {/* Right: internal designer chip — clickable to open picker */}
            <InlineDesignerPicker
              staff={staff}
              currentId={brief.assigned_designer_id ?? null}
              currentName={brief.assigned_designer_name ?? null}
              currentAvatar={brief.assigned_designer_avatar ?? null}
              onAssign={onAssign}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

function InlineDesignerPicker({ staff, currentId, currentName, currentAvatar, onAssign }: {
  staff: StaffLite[]
  currentId: string | null
  currentName: string | null
  currentAvatar: string | null
  onAssign: (staffId: string | null) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = React.useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  function pick(id: string | null) { onAssign(id); setOpen(false) }

  return (
    <div className="relative" ref={ref} onClick={e => e.stopPropagation()}>
      <button
        onClick={() => setOpen(v => !v)}
        aria-label={currentName ? `Assigned to ${currentName}` : 'Assign designer'}
        className={`flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
          currentName
            ? 'bg-[var(--surface)] border border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--brand)]'
            : 'border border-dashed border-[var(--border)] text-[var(--text-dim)] hover:border-[var(--brand)] hover:text-[var(--brand)]'
        }`}
      >
        <div className="h-4 w-4 rounded-full bg-[var(--surface-3)] flex items-center justify-center overflow-hidden">
          {currentAvatar
            ? <img src={currentAvatar} alt="" className="h-full w-full object-cover" />
            : currentName
              ? <span className="text-[8px] font-bold text-[var(--text)]">{currentName.slice(0, 1).toUpperCase()}</span>
              : <User className="h-3 w-3" />
          }
        </div>
        <span className="truncate max-w-[60px]">{currentName?.split(' ')[0] ?? 'Assign'}</span>
      </button>

      {open && (
        <div className="absolute right-0 bottom-full mb-1 w-44 rounded-xl bg-[var(--surface)] border border-[var(--border)] shadow-xl z-40 overflow-hidden">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] px-3 pt-2.5 pb-1">Assign designer</p>
          <div className="max-h-48 overflow-y-auto">
            {staff.map(s => (
              <button
                key={s.id}
                onClick={() => pick(s.id)}
                className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-[var(--text)] hover:bg-[var(--surface-2)] transition-colors"
              >
                <div className="h-5 w-5 rounded-full bg-[var(--surface-3)] flex items-center justify-center overflow-hidden flex-shrink-0">
                  {s.avatar_url
                    ? <img src={s.avatar_url} alt="" className="h-full w-full object-cover" />
                    : <span className="text-[9px] font-bold">{(s.name ?? s.email ?? '?').slice(0, 1).toUpperCase()}</span>
                  }
                </div>
                <span className="truncate flex-1 text-left">{s.name ?? s.email}</span>
              </button>
            ))}
            {staff.length === 0 && (
              <p className="px-3 py-4 text-[10px] text-[var(--text-dim)] text-center">No staff members yet</p>
            )}
          </div>
          {currentId && (
            <button
              onClick={() => pick(null)}
              className="flex items-center gap-2 w-full px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 transition-colors border-t border-[var(--border-muted)]"
            >
              <X className="h-3 w-3" /> Unassign
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Create Brief Modal ───────────────────────────────────────────────────────

function CreateBriefModal({ clientId, clientColor, clientName, onClose, onCreated }: {
  clientId: string
  clientColor: string
  clientName: string
  onClose: () => void
  onCreated: () => void
}) {
  const [name, setName]               = useState('')
  const [description, setDesc]        = useState('')
  const [campaign, setCampaign]       = useState('')
  const [contentType, setContentType] = useState('')
  const [dueDate, setDueDate]         = useState('')
  const [saving, setSaving]           = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    const supabase = createClient()

    // Auto-assignment: if this client has a default assignee in
    // staff_default_assignments, tag the new brief with that designer.
    // First match wins (the table supports many-to-many but briefs.assigned_to
    // is a single uuid, so we pick one deterministically).
    let assignedTo: string | null = null
    try {
      const { data: defaults } = await supabase
        .from('staff_default_assignments')
        .select('staff_id')
        .eq('client_id', clientId)
        .order('created_at', { ascending: true })
        .limit(1)
      assignedTo = (defaults?.[0] as { staff_id: string } | undefined)?.staff_id ?? null
    } catch { /* table may not be deployed yet — skip auto-assign silently */ }

    await supabase.from('briefs').insert({
      name:            name.trim(),
      description:     description.trim() || null,
      campaign:        campaign.trim() || null,
      content_type:    contentType || null,
      due_date:        dueDate || null,
      client_id:       clientId,
      pipeline_status: 'backlog',
      internal_status: 'in_production',
      assigned_to:     assignedTo,
    })
    setSaving(false)
    onCreated()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: clientColor }}>
              {clientName.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <h2 className="font-bold text-[var(--text)] text-sm">New brief</h2>
              <p className="text-xs text-[var(--text-muted)]">{clientName}</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-[var(--text-dim)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide block mb-1.5">Brief name *</label>
            <input
              type="text" value={name} onChange={e => setName(e.target.value)}
              required autoFocus placeholder="e.g. Summer Sale Banner"
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] placeholder:text-[var(--text-dim)] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-ring)] focus:border-[var(--brand)]"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide block mb-1.5">Campaign</label>
              <input
                type="text" value={campaign} onChange={e => setCampaign(e.target.value)}
                placeholder="e.g. Summer 2025"
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] placeholder:text-[var(--text-dim)] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-ring)]"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide block mb-1.5">Due date</label>
              <input
                type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-ring)]"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide block mb-1.5">Content type</label>
            <div className="flex gap-2 flex-wrap">
              {CONTENT_TYPES.map(t => (
                <button
                  key={t} type="button"
                  onClick={() => setContentType(contentType === t ? '' : t)}
                  className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                    contentType === t
                      ? 'text-white border-transparent bg-[var(--brand)]'
                      : 'bg-[var(--surface-2)] border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-3)]'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide block mb-1.5">Brief details</label>
            <textarea
              value={description} onChange={e => setDesc(e.target.value)}
              rows={3} placeholder="Describe what's needed, references, requirements…"
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] placeholder:text-[var(--text-dim)] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-ring)] resize-none"
            />
          </div>
          <button
            type="submit" disabled={saving || !name.trim()}
            className="w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-white bg-[var(--brand)] hover:bg-[var(--brand-hover)] disabled:opacity-50 transition-colors"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create brief'}
          </button>
        </form>
      </div>
    </div>
  )
}
