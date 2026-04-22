'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Video, Image as ImageIcon, Mail, LayoutGrid, Mic, FileText, CircleDot,
  User, Loader2, X, Check, Search, AlertTriangle, Play, Send, MessageSquare,
  CalendarDays, Paperclip, Clock, Eye,
} from 'lucide-react'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'
import { createClient } from '@/lib/supabase/client'
import { format } from 'date-fns'
import { BriefDrawer } from '@/components/pipeline/BriefDrawer'
import { updateBriefStatus } from '@/lib/pipeline/updateBriefStatus'

// ─── Types ────────────────────────────────────────────────────────────────────

interface PipelineBrief {
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
  created_at: string
  client_name: string
  client_color: string
  client_logo: string | null
  assignee_name: string | null
  assignee_avatar: string | null
  assignee_email: string | null
  comment_count: number
  attachment_count: number
}

interface StaffMember { id: string; name: string | null; avatar_url: string | null; email: string | null }

// ─── Content type chips ───────────────────────────────────────────────────────

const CONTENT_TYPES = [
  { id: 'Video',     icon: Video,      color: '#22c55e' },
  { id: 'Graphic',   icon: ImageIcon,  color: '#f97316' },
  { id: 'EDM',       icon: Mail,       color: '#ef4444' },
  { id: 'Signage',   icon: LayoutGrid, color: '#0ea5e9' },
  { id: 'Voiceover', icon: Mic,        color: '#a855f7' },
  { id: 'Script',    icon: FileText,   color: '#f59e0b' },
  { id: 'Other',     icon: CircleDot,  color: '#94a3b8' },
]

// ─── Hub-native column set ───────────────────────────────────────────────────
//
// Backlog          → Hub hasn't claimed the brief yet (client sees "In Production")
// In Production    → Designer is actively working on it (or revisions pending)
// Ready for Review → Draft uploaded; may also include briefs pushed to client for review
// Approved         → Client approved
//
// Revisions surface as a red badge on the In Production card, not a column.
// Pushed-to-client briefs live in Ready for Review, identifiable via the
// "Awaiting client review" filter chip.

type ColumnKey = 'backlog' | 'in_production' | 'ready_for_review' | 'approved'

const COLUMNS: Array<{ key: ColumnKey; label: string; helper: string }> = [
  { key: 'backlog',          label: 'Backlog',          helper: 'Unclaimed briefs from clients' },
  { key: 'in_production',    label: 'In Production',    helper: 'Designer working or revising' },
  { key: 'ready_for_review', label: 'Ready for Review', helper: 'Draft uploaded · ready to push' },
  { key: 'approved',         label: 'Approved',         helper: 'Client approved · shipped' },
]

/** Map a brief onto its Hub column.
 *
 *  Backlog is the default bucket for anything sitting at
 *  pipeline_status='in_production' that hasn't been moved through Hub stages
 *  yet — so every Portal-created brief surfaces here on arrival, regardless
 *  of whether it's been auto-assigned to a designer. A brief leaves Backlog
 *  as soon as one of the "active" signals fires: a draft link is attached,
 *  the client requests revisions, internal review is triggered, the client
 *  is reviewing, or the brief is approved.
 */
function columnFor(b: PipelineBrief): ColumnKey {
  if (b.pipeline_status === 'approved') return 'approved'
  if (b.internal_status === 'approved_by_client') return 'approved'
  if (b.pipeline_status === 'client_review') return 'ready_for_review' // with client — still ready-for-review on Hub
  if (b.internal_status === 'in_review') return 'ready_for_review'
  if (b.internal_status === 'revisions_required') return 'in_production'
  if (b.draft_url) return 'in_production'
  return 'backlog'
}

/** Convert a target column back to the (pipeline_status, internal_status) pair we write to DB. */
function dbStatusForColumn(col: ColumnKey): { pipeline_status: string; internal_status: string } {
  switch (col) {
    case 'backlog':          return { pipeline_status: 'in_production', internal_status: 'in_production' }
    case 'in_production':    return { pipeline_status: 'in_production', internal_status: 'in_production' }
    case 'ready_for_review': return { pipeline_status: 'in_production', internal_status: 'in_review' }
    case 'approved':         return { pipeline_status: 'approved',      internal_status: 'approved_by_client' }
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function InternalPipeline() {
  const [briefs, setBriefs] = useState<PipelineBrief[]>([])
  const [staff, setStaff]   = useState<StaffMember[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [selected, setSelected] = useState<PipelineBrief | null>(null)
  const [mounted, setMounted] = useState(false)

  // Filters
  const [query, setQuery] = useState('')
  const [myOnly, setMyOnly] = useState(false)
  const [unassignedOnly, setUnassignedOnly] = useState(false)
  const [awaitingClient, setAwaitingClient] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  async function load() {
    const supabase = createClient()
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) setCurrentUserId(user.id)

      const [{ data: profile }, { data: briefData }, { data: staffData }] = await Promise.all([
        user
          ? supabase.from('profiles').select('is_admin, hub_role').eq('id', user.id).single()
          : Promise.resolve({ data: null, error: null }),
        supabase
          .from('briefs')
          .select('id, name, description, campaign, content_type, pipeline_status, internal_status, draft_url, due_date, client_id, cover_url, assigned_to, created_at')
          .in('pipeline_status', ['in_production', 'qa_review', 'client_review', 'approved'])
          .order('created_at', { ascending: false }),
        supabase
          .from('profiles')
          .select('id, name, avatar_url, email')
          .or('is_staff.eq.true,is_admin.eq.true,hub_role.eq.admin,hub_role.eq.designer'),
      ])

      const p = profile as { is_admin?: boolean; hub_role?: string | null } | null
      setIsAdmin(p?.hub_role === 'admin' || p?.is_admin === true)
      setStaff((staffData as StaffMember[]) ?? [])

      if (!briefData?.length) { setBriefs([]); return }

      const clientIds = [...new Set(briefData.map((b: { client_id: string }) => b.client_id))]
      const assigneeIds = [...new Set(briefData.map((b: { assigned_to?: string | null }) => b.assigned_to).filter((id): id is string => !!id))]
      const briefIds = briefData.map((b: { id: string }) => b.id)

      const [
        { data: clientData },
        { data: rawAssignees },
        { data: commentRows },
        { data: attachmentRows },
      ] = await Promise.all([
        supabase.from('clients').select('id, name, color, logo_url').in('id', clientIds),
        assigneeIds.length
          ? supabase.from('profiles').select('id, name, avatar_url, email').in('id', assigneeIds)
          : Promise.resolve({ data: [], error: null }),
        supabase.from('brief_comments').select('brief_id').in('brief_id', briefIds),
        // brief_attachments may not exist yet — swallow error silently
        supabase.from('brief_attachments').select('brief_id').in('brief_id', briefIds)
          .then(res => res, () => ({ data: [] as { brief_id: string }[] })),
      ])

      const commentCounts: Record<string, number> = {}
      commentRows?.forEach((c: { brief_id: string }) => { commentCounts[c.brief_id] = (commentCounts[c.brief_id] ?? 0) + 1 })
      const attachmentCounts: Record<string, number> = {}
      ;((attachmentRows as { brief_id: string }[] | null) ?? []).forEach(a => {
        attachmentCounts[a.brief_id] = (attachmentCounts[a.brief_id] ?? 0) + 1
      })

      const assigneeData = rawAssignees ?? []
      setBriefs(briefData.map((b: Record<string, unknown>) => {
        const client = clientData?.find((c: { id: string }) => c.id === b.client_id)
        const assignee = assigneeData.find((p: { id: unknown }) => p.id === b.assigned_to)
        return {
          ...b,
          client_name:     (client as { name?: string })?.name ?? 'Unknown',
          client_color:    (client as { color?: string })?.color ?? '#4950F8',
          client_logo:     (client as { logo_url?: string | null })?.logo_url ?? null,
          assignee_name:   (assignee as { name?: string | null })?.name ?? null,
          assignee_avatar: (assignee as { avatar_url?: string | null })?.avatar_url ?? null,
          assignee_email:  (assignee as { email?: string | null })?.email ?? null,
          comment_count:    commentCounts[b.id as string] ?? 0,
          attachment_count: attachmentCounts[b.id as string] ?? 0,
        } as PipelineBrief
      }))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    const supabase = createClient()
    const channel = supabase
      .channel('hub-pipeline-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'briefs' }, load)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function moveBrief(briefId: string, targetCol: ColumnKey) {
    const brief = briefs.find(b => b.id === briefId)
    if (!brief) return
    if (!isAdmin && brief.assigned_to !== currentUserId) {
      // Designers can only move their own assigned briefs
      return
    }
    const { pipeline_status, internal_status } = dbStatusForColumn(targetCol)
    // Optimistic
    setBriefs(prev => prev.map(b => b.id === briefId ? { ...b, pipeline_status, internal_status } : b))
    if (selected?.id === briefId) setSelected(prev => prev ? { ...prev, pipeline_status, internal_status } : null)
    await updateBriefStatus(briefId, { pipeline_status, internal_status })
  }

  async function assignBrief(briefId: string, userId: string | null) {
    const supabase = createClient()
    await supabase.from('briefs').update({ assigned_to: userId }).eq('id', briefId)
    const assignee = userId ? staff.find(s => s.id === userId) : null
    setBriefs(prev => prev.map(b => b.id === briefId ? {
      ...b,
      assigned_to: userId,
      assignee_name: assignee?.name ?? null,
      assignee_avatar: assignee?.avatar_url ?? null,
      assignee_email: assignee?.email ?? null,
    } : b))
  }

  async function pushToClient(briefId: string) {
    const updates = await updateBriefStatus(briefId, { pipeline_status: 'client_review', internal_status: 'in_review' })
    setBriefs(prev => prev.map(b => b.id === briefId ? { ...b, ...updates } : b))
  }

  async function onDragEnd(result: DropResult) {
    const { draggableId, destination } = result
    if (!destination) return
    const target = destination.droppableId as ColumnKey
    const brief = briefs.find(b => b.id === draggableId)
    if (!brief) return
    const current = columnFor(brief)
    if (current === target) return
    await moveBrief(draggableId, target)
  }

  // ─── Filtering ──────────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return briefs.filter(b => {
      if (q) {
        const matches =
          b.name.toLowerCase().includes(q) ||
          b.client_name.toLowerCase().includes(q) ||
          (b.assignee_name?.toLowerCase().includes(q) ?? false)
        if (!matches) return false
      }
      if (myOnly && b.assigned_to !== currentUserId) return false
      if (unassignedOnly && b.assigned_to) return false
      if (awaitingClient && b.pipeline_status !== 'client_review') return false
      return true
    })
  }, [briefs, query, myOnly, unassignedOnly, awaitingClient, currentUserId])

  const byColumn = useMemo(() => {
    const out: Record<ColumnKey, PipelineBrief[]> = { backlog: [], in_production: [], ready_for_review: [], approved: [] }
    for (const b of filtered) out[columnFor(b)].push(b)
    return out
  }, [filtered])

  const myCount         = useMemo(() => briefs.filter(b => b.assigned_to === currentUserId).length, [briefs, currentUserId])
  const unassignedCount = useMemo(() => briefs.filter(b => !b.assigned_to && b.pipeline_status !== 'approved').length, [briefs])
  const awaitingCount   = useMemo(() => briefs.filter(b => b.pipeline_status === 'client_review').length, [briefs])

  if (loading) return (
    <div className="flex items-center justify-center h-[60vh]">
      <Loader2 className="h-6 w-6 animate-spin text-[var(--brand)]" />
    </div>
  )

  const board = (
    <div className="grid grid-cols-4 gap-3 items-start min-h-0">
      {COLUMNS.map(col => (
        <PipelineColumn
          key={col.key}
          col={col}
          briefs={byColumn[col.key]}
          staff={staff}
          isAdmin={isAdmin}
          currentUserId={currentUserId}
          onSelect={setSelected}
          onAssign={assignBrief}
          onPush={pushToClient}
        />
      ))}
    </div>
  )

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-[var(--text)]">Production Pipeline</h1>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">
            {briefs.length} brief{briefs.length !== 1 ? 's' : ''} · {filtered.length} shown
          </p>
        </div>
      </div>

      {/* Search + filter chips */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 max-w-md min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-dim)]" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search briefs, clients, designers..."
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-sm text-[var(--text)] placeholder:text-[var(--text-dim)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-ring)] focus:border-[var(--brand)]"
          />
        </div>
        <FilterChip active={myOnly} onClick={() => setMyOnly(v => !v)} icon={User} label="My briefs" count={myCount} />
        <FilterChip active={unassignedOnly} onClick={() => setUnassignedOnly(v => !v)} icon={User} label="Unassigned" count={unassignedCount} />
        <FilterChip active={awaitingClient} onClick={() => setAwaitingClient(v => !v)} icon={Clock} label="Awaiting client review" count={awaitingCount} />
      </div>

      {/* Board */}
      {mounted ? <DragDropContext onDragEnd={onDragEnd}>{board}</DragDropContext> : board}

      {/* Drawer */}
      {selected && (
        <BriefDrawer
          brief={selected}
          clientColor={selected.client_color}
          clientName={selected.client_name}
          onClose={() => setSelected(null)}
          onMove={async (id, stage) => {
            // stage is a pipeline_status from BriefDrawer; translate to a column then call moveBrief
            const target: ColumnKey =
              stage === 'approved' ? 'approved'
              : stage === 'client_review' ? 'ready_for_review'
              : 'in_production'
            await moveBrief(id, target)
          }}
          onInternalMove={async (id, status) => {
            const supabase = createClient()
            await supabase.from('briefs').update({ internal_status: status }).eq('id', id)
            setBriefs(prev => prev.map(b => b.id === id ? { ...b, internal_status: status } : b))
          }}
          onRefresh={load}
          onBriefUpdate={(updates) => {
            setBriefs(prev => prev.map(b => b.id === selected.id ? { ...b, ...updates } : b))
            setSelected(prev => prev ? { ...prev, ...updates } : null)
          }}
          internalMode
        />
      )}
    </div>
  )
}

// ─── Pipeline Column ──────────────────────────────────────────────────────────

function PipelineColumn({ col, briefs, staff, isAdmin, currentUserId, onSelect, onAssign, onPush }: {
  col: { key: ColumnKey; label: string; helper: string }
  briefs: PipelineBrief[]
  staff: StaffMember[]
  isAdmin: boolean
  currentUserId: string | null
  onSelect: (b: PipelineBrief) => void
  onAssign: (briefId: string, uid: string | null) => void
  onPush: (briefId: string) => void
}) {
  return (
    <div className="flex flex-col rounded-2xl border border-[var(--border)] bg-[var(--surface)] min-h-[240px]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-muted)]">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)] truncate">{col.label}</span>
          <span className="text-[11px] font-bold rounded-full px-2 py-0.5 bg-[var(--surface-2)] text-[var(--text)]">{briefs.length}</span>
        </div>
      </div>
      <Droppable droppableId={col.key}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`flex-1 p-3 space-y-2 min-h-[160px] transition-colors ${
              snapshot.isDraggingOver ? 'bg-[var(--brand-soft)]' : ''
            }`}
          >
            {briefs.map((brief, index) => (
              <Draggable key={brief.id} draggableId={brief.id} index={index}>
                {(dragProvided, dragSnapshot) => (
                  <div
                    ref={dragProvided.innerRef}
                    {...dragProvided.draggableProps}
                    {...dragProvided.dragHandleProps}
                  >
                    <PipelineCard
                      brief={brief}
                      staff={staff}
                      canAssign={isAdmin}
                      canMove={isAdmin || brief.assigned_to === currentUserId}
                      isDragging={dragSnapshot.isDragging}
                      onClick={() => onSelect(brief)}
                      onAssign={uid => onAssign(brief.id, uid)}
                      onPush={() => onPush(brief.id)}
                    />
                  </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
            {briefs.length === 0 && (
              <div className="rounded-xl border border-dashed border-[var(--border)] py-10 text-center">
                <p className="text-xs text-[var(--text-dim)]">{col.helper}</p>
              </div>
            )}
          </div>
        )}
      </Droppable>
    </div>
  )
}

// ─── Pipeline Card ────────────────────────────────────────────────────────────

function PipelineCard({ brief, staff, canAssign, canMove, isDragging, onClick, onAssign, onPush }: {
  brief: PipelineBrief
  staff: StaffMember[]
  canAssign: boolean
  canMove: boolean
  isDragging?: boolean
  onClick: () => void
  onAssign: (uid: string | null) => void
  onPush: () => void
}) {
  const typeInfo = CONTENT_TYPES.find(t => t.id === brief.content_type)
  const isRevisions = brief.internal_status === 'revisions_required'
  const isAwaitingClient = brief.pipeline_status === 'client_review'
  const isReady = columnFor(brief) === 'ready_for_review'
  const hasDraft = !!brief.draft_url

  return (
    <div
      onClick={onClick}
      className={`rounded-xl border bg-[var(--surface-2)] transition-all cursor-pointer overflow-hidden ${
        isDragging ? 'scale-[1.02] shadow-2xl border-[var(--brand)]' : 'border-[var(--border)] hover:border-[var(--brand-soft)] hover:bg-[var(--surface-3)]'
      } ${!canMove ? 'opacity-90' : ''}`}
    >
      {/* Left accent stripe in client color */}
      <div className="flex">
        <div className="w-1 flex-shrink-0" style={{ backgroundColor: brief.client_color }} />
        <div className="flex-1 p-3 min-w-0 space-y-2">
          {/* Header: client + assignee */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <div
                className="h-4 w-4 rounded flex items-center justify-center text-white text-[8px] font-bold flex-shrink-0 overflow-hidden"
                style={{ backgroundColor: brief.client_color }}
              >
                {brief.client_logo
                  ? <img src={brief.client_logo} alt="" className="h-full w-full object-contain" />
                  : brief.client_name.slice(0, 2).toUpperCase()
                }
              </div>
              <span className="text-[10px] font-semibold text-[var(--text-muted)] truncate">{brief.client_name}</span>
            </div>
            <AssigneePicker brief={brief} staff={staff} canAssign={canAssign} onAssign={onAssign} />
          </div>

          {/* Type chip */}
          {typeInfo && (
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
              style={{ backgroundColor: `${typeInfo.color}22`, color: typeInfo.color }}
            >
              <typeInfo.icon className="h-2.5 w-2.5" />
              {typeInfo.id}
            </span>
          )}

          {/* Title */}
          <p className="text-xs font-semibold text-[var(--text)] leading-snug line-clamp-2">{brief.name}</p>

          {/* Badges */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {isRevisions && (
              <span className="text-[10px] font-semibold rounded-full px-2 py-0.5 bg-red-500/10 border border-red-500/30 text-red-400">
                Revisions
              </span>
            )}
            {isAwaitingClient && (
              <span className="text-[10px] font-semibold rounded-full px-2 py-0.5 bg-blue-500/10 border border-blue-500/30 text-blue-400">
                With client
              </span>
            )}
          </div>

          {/* Footer meta row */}
          <div className="flex items-center justify-between gap-2 pt-1 border-t border-[var(--border-muted)]">
            <div className="flex items-center gap-2 text-[10px] text-[var(--text-dim)]">
              {brief.due_date && (
                <span className="flex items-center gap-1">
                  <CalendarDays className="h-2.5 w-2.5" />
                  {format(new Date(brief.due_date), 'd MMM')}
                </span>
              )}
              {brief.comment_count > 0 && (
                <span className="flex items-center gap-1">
                  <MessageSquare className="h-2.5 w-2.5" />
                  {brief.comment_count}
                </span>
              )}
              {brief.attachment_count > 0 && (
                <span className="flex items-center gap-1">
                  <Paperclip className="h-2.5 w-2.5" />
                  {brief.attachment_count}
                </span>
              )}
            </div>
          </div>

          {/* Workflow actions on ready-for-review cards */}
          {isReady && !isAwaitingClient && (
            <div className="flex gap-1.5 pt-1" onClick={e => e.stopPropagation()}>
              {hasDraft && (
                <a
                  href={brief.draft_url ?? '#'}
                  target="_blank" rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] py-1 text-[10px] font-medium text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-2)] transition-colors"
                >
                  <Play className="h-2.5 w-2.5" />
                  View
                </a>
              )}
              {hasDraft ? (
                <button
                  onClick={onPush}
                  className="flex-1 flex items-center justify-center gap-1 rounded-lg bg-[var(--brand)] hover:bg-[var(--brand-hover)] py-1 text-[10px] font-semibold text-white transition-colors"
                >
                  <Send className="h-2.5 w-2.5" />
                  Push to client
                </button>
              ) : (
                <button
                  onClick={onClick}
                  className="flex-1 flex items-center justify-center gap-1 rounded-lg border border-dashed border-[var(--border)] bg-transparent py-1 text-[10px] font-medium text-[var(--text-dim)] hover:text-[var(--text)] hover:border-[var(--brand)] transition-colors"
                >
                  <Eye className="h-2.5 w-2.5" />
                  Add draft link
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Assignee picker ──────────────────────────────────────────────────────────

function AssigneePicker({ brief, staff, canAssign, onAssign }: {
  brief: PipelineBrief
  staff: StaffMember[]
  canAssign: boolean
  onAssign: (uid: string | null) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function h(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  return (
    <div className="relative" ref={ref} onClick={e => e.stopPropagation()}>
      <button
        onClick={() => canAssign && setOpen(v => !v)}
        className={`flex items-center justify-center h-6 w-6 rounded-full border border-[var(--border)] bg-[var(--surface)] overflow-hidden flex-shrink-0 ${
          canAssign ? 'hover:border-[var(--brand)] cursor-pointer' : 'cursor-default'
        }`}
        title={brief.assignee_name ?? 'Unassigned'}
      >
        {brief.assignee_avatar ? (
          <img src={brief.assignee_avatar} alt="" className="h-full w-full object-cover" />
        ) : brief.assignee_name ? (
          <span className="text-[9px] font-bold text-[var(--text)]">
            {brief.assignee_name.slice(0, 2).toUpperCase()}
          </span>
        ) : (
          <User className="h-3 w-3 text-[var(--text-dim)]" />
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-48 rounded-xl bg-[var(--surface)] border border-[var(--border)] shadow-xl z-40 overflow-hidden">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] px-3 pt-2.5 pb-1">Assign to</p>
          {staff.map(s => (
            <button
              key={s.id}
              onClick={() => { onAssign(s.id); setOpen(false) }}
              className="flex items-center gap-2.5 w-full px-3 py-2 text-xs text-[var(--text)] hover:bg-[var(--surface-2)] transition-colors"
            >
              {s.avatar_url ? (
                <img src={s.avatar_url} alt="" className="h-6 w-6 rounded-full object-cover flex-shrink-0" />
              ) : (
                <div className="h-6 w-6 rounded-full bg-[var(--surface-3)] flex items-center justify-center text-[9px] font-bold flex-shrink-0">
                  {(s.name ?? s.email ?? '?').slice(0, 1).toUpperCase()}
                </div>
              )}
              <span className="truncate">{s.name ?? s.email}</span>
              {brief.assigned_to === s.id && <Check className="h-3 w-3 text-emerald-400 ml-auto flex-shrink-0" />}
            </button>
          ))}
          {brief.assigned_to && (
            <button
              onClick={() => { onAssign(null); setOpen(false) }}
              className="flex items-center gap-2 w-full px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 transition-colors border-t border-[var(--border-muted)]"
            >
              <X className="h-3.5 w-3.5" /> Unassign
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Filter chip ──────────────────────────────────────────────────────────────

function FilterChip({ active, onClick, icon: Icon, label, count }: {
  active: boolean
  onClick: () => void
  icon: typeof User
  label: string
  count: number
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-colors border ${
        active
          ? 'bg-[var(--brand-soft)] border-[var(--brand)] text-[var(--brand)]'
          : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-2)]'
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
      <span className={`rounded-full text-[10px] font-bold px-1.5 py-0.5 ${
        active ? 'bg-[var(--brand)] text-white' : 'bg-[var(--surface-3)] text-[var(--text)]'
      }`}>
        {count}
      </span>
    </button>
  )
}

void AlertTriangle
