'use client'

import { useEffect, useState, useMemo, useRef } from 'react'
import {
  Video, Image, Mail, LayoutGrid, Mic, FileText, CircleDot,
  User, Loader2, X, Check, ChevronDown, Clock, AlertTriangle,
  Play, Send,
} from 'lucide-react'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'
import { createClient } from '@/lib/supabase/client'
import { format } from 'date-fns'
import { BriefDrawer } from '@/components/pipeline/BriefDrawer'
import { INTERNAL_STAGES } from '@/lib/pipeline/stages'
import { updateBriefStatus } from '@/lib/pipeline/updateBriefStatus'

const CONTENT_TYPES = [
  { id: 'Video',     icon: Video,      color: '#22c55e' },
  { id: 'Graphic',   icon: Image,      color: '#f97316' },
  { id: 'EDM',       icon: Mail,       color: '#ef4444' },
  { id: 'Signage',   icon: LayoutGrid, color: '#0ea5e9' },
  { id: 'Voiceover', icon: Mic,        color: '#a855f7' },
  { id: 'Script',    icon: FileText,   color: '#f59e0b' },
  { id: 'Other',     icon: CircleDot,  color: '#94a3b8' },
]

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
  client_name: string
  client_color: string
  client_logo: string | null
  assignee_name: string | null
  assignee_avatar: string | null
}

interface StaffMember {
  id: string
  name: string | null
  avatar_url: string | null
  email: string | null
}

interface ClientRow {
  id: string
  name: string
  color: string
  logo: string | null
}

function stageFor(b: PipelineBrief): string {
  const s = b.internal_status ?? ''
  if (INTERNAL_STAGES.find(st => st.key === s)) return s
  if (b.pipeline_status === 'approved') return 'approved_by_client'
  return 'in_production'
}

function Initials({ name, color, size = 28 }: { name: string | null; color: string; size?: number }) {
  return (
    <div
      className="rounded-full flex items-center justify-center text-white font-bold flex-shrink-0"
      style={{ width: size, height: size, backgroundColor: color, fontSize: size * 0.38 }}
    >
      {name ? name.slice(0, 2).toUpperCase() : '?'}
    </div>
  )
}

// ─── Assignee Picker ──────────────────────────────────────────────────────────

function AssigneePicker({ brief, staff, isAdmin, onAssign }: {
  brief: PipelineBrief
  staff: StaffMember[]
  isAdmin: boolean
  onAssign: (userId: string | null) => void
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
    <div className="relative" ref={ref}>
      <button
        onClick={e => { e.stopPropagation(); if (isAdmin) setOpen(v => !v) }}
        className={`flex items-center justify-center rounded-full border-2 border-white shadow-sm flex-shrink-0 ${isAdmin ? 'hover:opacity-80 transition-opacity cursor-pointer' : 'cursor-default'}`}
        style={{ width: 28, height: 28 }}
        title={brief.assignee_name ?? 'Unassigned'}
      >
        {brief.assignee_avatar ? (
          <img src={brief.assignee_avatar} alt="" className="h-7 w-7 rounded-full object-cover" />
        ) : brief.assignee_name ? (
          <Initials name={brief.assignee_name} color="#6366f1" size={28} />
        ) : (
          <div className="h-7 w-7 rounded-full bg-zinc-100 border border-zinc-200 flex items-center justify-center">
            <User className="h-3.5 w-3.5 text-zinc-400" />
          </div>
        )}
      </button>

      {open && (
        <div className="absolute bottom-full mb-1 right-0 w-48 rounded-xl bg-white border border-zinc-200 shadow-xl z-30 overflow-hidden">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 px-3 pt-2.5 pb-1">Assign to</p>
          {staff.map(s => (
            <button
              key={s.id}
              onClick={e => { e.stopPropagation(); onAssign(s.id); setOpen(false) }}
              className="flex items-center gap-2.5 w-full px-3 py-2 text-xs text-zinc-700 hover:bg-zinc-50 transition-colors"
            >
              {s.avatar_url
                ? <img src={s.avatar_url} alt="" className="h-6 w-6 rounded-full object-cover flex-shrink-0" />
                : <Initials name={s.name} color="#6366f1" size={24} />
              }
              <span className="truncate">{s.name ?? s.email}</span>
              {brief.assigned_to === s.id && <Check className="h-3 w-3 text-emerald-500 ml-auto flex-shrink-0" />}
            </button>
          ))}
          {brief.assigned_to && (
            <button
              onClick={e => { e.stopPropagation(); onAssign(null); setOpen(false) }}
              className="flex items-center gap-2 w-full px-3 py-2 text-xs text-red-400 hover:bg-red-50 transition-colors border-t border-zinc-100"
            >
              <X className="h-3.5 w-3.5" /> Unassign
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Client Assignment Panel ──────────────────────────────────────────────────

function ClientAssignmentPanel({ clients, staff, assignments, onSet }: {
  clients: ClientRow[]
  staff: StaffMember[]
  assignments: Record<string, string>
  onSet: (clientId: string, userId: string | null) => void
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
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium border border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 transition-colors"
      >
        <User className="h-3.5 w-3.5" />
        Client assignments
        <ChevronDown className="h-3 w-3" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-72 rounded-2xl bg-white border border-zinc-200 shadow-2xl z-30 overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-100">
            <p className="text-xs font-semibold text-zinc-800">Default assignee per client</p>
            <p className="text-[10px] text-zinc-400 mt-0.5">All new production briefs from this client auto-assign to this person</p>
          </div>
          <div className="max-h-72 overflow-y-auto">
            {clients.length === 0 && (
              <p className="text-xs text-zinc-400 px-4 py-6 text-center">No active clients in pipeline</p>
            )}
            {clients.map(client => (
              <div key={client.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-zinc-50 last:border-0">
                <div
                  className="h-6 w-6 rounded-md flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0 overflow-hidden"
                  style={{ backgroundColor: client.color }}
                >
                  {client.logo
                    ? <img src={client.logo} alt="" className="h-full w-full object-contain p-0.5" />
                    : client.name.slice(0, 2).toUpperCase()
                  }
                </div>
                <span className="text-xs font-medium text-zinc-700 flex-1 truncate">{client.name}</span>
                <select
                  value={assignments[client.id] ?? ''}
                  onChange={e => onSet(client.id, e.target.value || null)}
                  className="text-[11px] text-zinc-600 border border-zinc-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-300"
                >
                  <option value="">Unassigned</option>
                  {staff.map(s => (
                    <option key={s.id} value={s.id}>{s.name ?? s.email}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Kanban Columns ──────────────────────────────────────────────────────────

function KanbanColumns({ stages, byStage, staff, isAdmin, onSelect, onAssign, onPushToClient }: {
  stages: typeof INTERNAL_STAGES
  byStage: Record<string, PipelineBrief[]>
  staff: StaffMember[]
  isAdmin: boolean
  onSelect: (b: PipelineBrief) => void
  onAssign: (briefId: string, uid: string | null) => void
  onPushToClient: (briefId: string) => void
}) {
  return (
    <div className="grid grid-cols-4 gap-4 items-start">
      {stages.map(stage => (
        <div
          key={stage.key}
          className="rounded-2xl overflow-hidden border border-zinc-100"
          style={{ backgroundColor: stage.bgColor }}
        >
          <div className="flex items-center gap-2 px-4 py-3 border-b border-black/5">
            <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: stage.dotColor }} />
            <h3 className="text-sm font-semibold text-zinc-800 flex-1">{stage.label}</h3>
            <span
              className="text-[11px] font-bold rounded-full px-2 py-0.5"
              style={{ backgroundColor: `${stage.dotColor}22`, color: stage.dotColor }}
            >
              {byStage[stage.key].length}
            </span>
          </div>

          <Droppable droppableId={stage.key}>
            {(provided, snapshot) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className={`p-3 space-y-3 min-h-[160px] transition-colors ${snapshot.isDraggingOver ? 'bg-black/5' : ''}`}
              >
                {byStage[stage.key].map((brief, index) => (
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
                          isAdmin={isAdmin}
                          isDragging={dragSnapshot.isDragging}
                          onClick={() => onSelect(brief)}
                          onAssign={uid => onAssign(brief.id, uid)}
                          onPushToClient={() => onPushToClient(brief.id)}
                        />
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
                {byStage[stage.key].length === 0 && (
                  <div className="rounded-xl border border-dashed border-zinc-200 py-10 text-center">
                    <p className="text-xs text-zinc-400">Nothing here</p>
                  </div>
                )}
              </div>
            )}
          </Droppable>
        </div>
      ))}
    </div>
  )
}

// ─── Pipeline Card ────────────────────────────────────────────────────────────

function PipelineCard({ brief, staff, isAdmin, onClick, onAssign, onPushToClient, isDragging }: {
  brief: PipelineBrief
  staff: StaffMember[]
  isAdmin: boolean
  onClick: () => void
  onAssign: (userId: string | null) => void
  onPushToClient: () => void
  isDragging?: boolean
}) {
  const typeInfo = CONTENT_TYPES.find(t => t.id === brief.content_type)
  const alreadySent = brief.pipeline_status === 'client_review' || brief.pipeline_status === 'approved'

  const ghostBtn = 'flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-zinc-100 bg-white py-1.5 text-[11px] font-medium text-zinc-400 hover:border-zinc-200 hover:text-zinc-600 transition-colors'

  return (
    <div
      onClick={onClick}
      className={`rounded-2xl bg-white border transition-all cursor-pointer ${
        isDragging
          ? 'rotate-1 scale-[1.02] border-transparent shadow-2xl'
          : 'border-zinc-100 shadow-sm hover:shadow-md'
      }`}
      style={isDragging ? { boxShadow: `0 0 0 2px ${brief.client_color}, 0 20px 40px ${brief.client_color}44` } : {}}
    >
      {brief.cover_url ? (
        <div className="h-24 rounded-t-2xl overflow-hidden">
          <img src={brief.cover_url} alt="" className="w-full h-full object-cover" />
        </div>
      ) : (
        <div className="h-1.5 rounded-t-2xl" style={{ backgroundColor: brief.client_color }} />
      )}

      <div className="p-3">
        <div className="flex items-center justify-between mb-2">
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
            <span className="text-[10px] font-semibold text-zinc-400 truncate">{brief.client_name}</span>
          </div>
          <AssigneePicker brief={brief} staff={staff} isAdmin={isAdmin} onAssign={onAssign} />
        </div>

        {typeInfo && (
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold mb-1.5"
            style={{ backgroundColor: `${typeInfo.color}18`, color: typeInfo.color }}
          >
            <typeInfo.icon className="h-2.5 w-2.5" />
            {typeInfo.id}
          </span>
        )}

        <p className="text-xs font-semibold text-zinc-800 leading-snug mb-2">{brief.name}</p>

        {brief.due_date && (
          <span className="flex items-center gap-1 text-[10px] text-zinc-400 mb-2">
            <Clock className="h-2.5 w-2.5" />
            {format(new Date(brief.due_date), 'd MMM')}
          </span>
        )}

        {brief.draft_url && (
          <div className={`mt-1 ${!alreadySent ? 'flex gap-1.5' : ''}`} onClick={e => e.stopPropagation()}>
            <a href={brief.draft_url} target="_blank" rel="noopener noreferrer" className={ghostBtn}>
              <Play className="h-2.5 w-2.5" />
              View Draft
            </a>
            {!alreadySent && (
              <button onClick={e => { e.stopPropagation(); onPushToClient() }} className={ghostBtn}>
                <Send className="h-2.5 w-2.5" />
                Push to Client
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function InternalPipeline() {
  const [briefs, setBriefs]                       = useState<PipelineBrief[]>([])
  const [staff, setStaff]                         = useState<StaffMember[]>([])
  const [clientAssignments, setClientAssignments] = useState<Record<string, string>>({})
  const [loading, setLoading]                     = useState(true)
  const [currentUserId, setCurrentUserId]         = useState<string | null>(null)
  const [isAdmin, setIsAdmin]                     = useState(false)
  const [myBriefsOnly, setMyBriefsOnly]           = useState(false)
  const [selected, setSelected]                   = useState<PipelineBrief | null>(null)
  const [mounted, setMounted]                     = useState(false)

  useEffect(() => { setMounted(true) }, [])

  async function load() {
    const supabase = createClient()
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) setCurrentUserId(user.id)

      const [
        { data: profile },
        { data: briefData },
        { data: staffData },
        { data: caData },
      ] = await Promise.all([
        user
          ? supabase.from('profiles').select('is_admin').eq('id', user.id).single()
          : Promise.resolve({ data: null, error: null }),
        supabase
          .from('briefs')
          .select('id, name, description, campaign, content_type, pipeline_status, internal_status, draft_url, due_date, client_id, cover_url, assigned_to, created_at')
          .eq('pipeline_status', 'in_production')
          .not('internal_status', 'is', null)
          .order('created_at', { ascending: false }),
        supabase.from('profiles').select('id, name, avatar_url, email').or('is_staff.eq.true,is_admin.eq.true'),
        supabase.from('client_assignments').select('client_id, assigned_to'),
      ])

      if (profile) setIsAdmin((profile as { is_admin?: boolean }).is_admin ?? false)
      setStaff((staffData as StaffMember[]) ?? [])

      const caMap: Record<string, string> = {}
      caData?.forEach((ca: { client_id: string; assigned_to: string }) => { caMap[ca.client_id] = ca.assigned_to })
      setClientAssignments(caMap)

      if (!briefData?.length) { setBriefs([]); return }

      const clientIds    = [...new Set(briefData.map((b: { client_id: string }) => b.client_id))]
      const assigneeIds  = [...new Set(briefData.map((b: { assigned_to?: string | null }) => b.assigned_to).filter((id): id is string => !!id))]

      const [{ data: clientData }, { data: rawAssignees }] = await Promise.all([
        supabase.from('clients').select('id, name, color, logo_url').in('id', clientIds),
        assigneeIds.length > 0
          ? supabase.from('profiles').select('id, name, avatar_url').in('id', assigneeIds)
          : Promise.resolve({ data: [], error: null }),
      ])

      const assigneeData = rawAssignees ?? []
      setBriefs(briefData.map((b: Record<string, unknown>) => {
        const client   = clientData?.find((c: { id: string }) => c.id === b.client_id)
        const assignee = assigneeData.find((p: { id: unknown }) => p.id === b.assigned_to)
        return {
          ...b,
          client_name:     (client as { name?: string })?.name          ?? 'Unknown',
          client_color:    (client as { color?: string })?.color         ?? '#6366f1',
          client_logo:     (client as { logo_url?: string | null })?.logo_url ?? null,
          assignee_name:   (assignee as { name?: string | null } | undefined)?.name          ?? null,
          assignee_avatar: (assignee as { avatar_url?: string | null } | undefined)?.avatar_url ?? null,
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

  async function moveInternal(briefId: string, newStatus: string) {
    const extra = newStatus === 'approved_by_client' ? { pipeline_status: 'approved' } : {}
    const updates = await updateBriefStatus(briefId, { internal_status: newStatus, ...extra })
    setBriefs(prev => prev.map(b => b.id === briefId ? { ...b, ...updates } : b))
    setSelected(prev => prev?.id === briefId ? { ...prev, ...updates } as PipelineBrief : prev)
  }

  async function moveClient(briefId: string, newStage: string) {
    const updates = await updateBriefStatus(briefId, { pipeline_status: newStage })
    setBriefs(prev => prev.map(b => b.id === briefId ? { ...b, ...updates } : b))
    setSelected(prev => prev?.id === briefId ? { ...prev, ...updates } as PipelineBrief : prev)
  }

  async function assignBrief(briefId: string, userId: string | null) {
    const supabase = createClient()
    await supabase.from('briefs').update({ assigned_to: userId }).eq('id', briefId)
    const assignee = userId ? staff.find(s => s.id === userId) : null
    setBriefs(prev => prev.map(b => b.id === briefId ? {
      ...b,
      assigned_to:     userId,
      assignee_name:   assignee?.name       ?? null,
      assignee_avatar: assignee?.avatar_url ?? null,
    } : b))
  }

  async function pushBriefToClient(briefId: string) {
    const updates = await updateBriefStatus(briefId, { pipeline_status: 'client_review', internal_status: 'in_review' })
    setBriefs(prev => prev.map(b => b.id === briefId ? { ...b, ...updates } : b))
  }

  async function setClientDefault(clientId: string, userId: string | null) {
    const supabase = createClient()
    if (!userId) {
      await supabase.from('client_assignments').delete().eq('client_id', clientId)
      setClientAssignments(prev => { const n = { ...prev }; delete n[clientId]; return n })
    } else {
      await supabase.from('client_assignments').upsert({ client_id: clientId, assigned_to: userId }, { onConflict: 'client_id' })
      setClientAssignments(prev => ({ ...prev, [clientId]: userId }))
      setBriefs(prev => prev.map(b =>
        b.client_id === clientId && !b.assigned_to
          ? { ...b, assigned_to: userId, assignee_name: staff.find(s => s.id === userId)?.name ?? null }
          : b
      ))
    }
  }

  async function onDragEnd(result: DropResult) {
    const { draggableId, destination } = result
    if (!destination) return
    const newStage = destination.droppableId
    const brief = briefs.find(b => b.id === draggableId)
    if (!brief || newStage === stageFor(brief)) return
    await moveInternal(draggableId, newStage)
  }

  const filtered = myBriefsOnly ? briefs.filter(b => b.assigned_to === currentUserId) : briefs

  const byStage = useMemo(() =>
    INTERNAL_STAGES.reduce((acc, stage) => {
      acc[stage.key] = filtered.filter(b => stageFor(b) === stage.key)
      return acc
    }, {} as Record<string, PipelineBrief[]>),
  [filtered])

  const uniqueClients = useMemo<ClientRow[]>(() =>
    [...new Map(briefs.map(b => [b.client_id, {
      id: b.client_id, name: b.client_name, color: b.client_color, logo: b.client_logo,
    }])).values()],
  [briefs])

  const revisionsCount = useMemo(() => briefs.filter(b => stageFor(b) === 'revisions_required').length, [briefs])

  if (loading) return (
    <div className="flex items-center justify-center h-[60vh]">
      <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
    </div>
  )

  const board = (
    <KanbanColumns
      stages={INTERNAL_STAGES}
      byStage={byStage}
      staff={staff}
      isAdmin={isAdmin}
      onSelect={setSelected}
      onAssign={assignBrief}
      onPushToClient={pushBriefToClient}
    />
  )

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-zinc-900">Production Pipeline</h1>
          <p className="text-sm text-zinc-400 mt-0.5">
            {briefs.length} active brief{briefs.length !== 1 ? 's' : ''} across {uniqueClients.length} client{uniqueClients.length !== 1 ? 's' : ''}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {revisionsCount > 0 && (
            <div className="flex items-center gap-1.5 rounded-lg bg-red-50 border border-red-100 px-3 py-1.5">
              <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
              <span className="text-xs font-semibold text-red-700">
                {revisionsCount} need{revisionsCount === 1 ? 's' : ''} revisions
              </span>
            </div>
          )}

          <button
            onClick={() => setMyBriefsOnly(v => !v)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium border transition-colors ${
              myBriefsOnly
                ? 'bg-indigo-50 border-indigo-200 text-indigo-600'
                : 'bg-white border-zinc-200 text-zinc-500 hover:border-zinc-300'
            }`}
          >
            <User className="h-3.5 w-3.5" />
            My briefs{myBriefsOnly && ` (${filtered.length})`}
          </button>

          {isAdmin && (
            <ClientAssignmentPanel
              clients={uniqueClients}
              staff={staff}
              assignments={clientAssignments}
              onSet={setClientDefault}
            />
          )}
        </div>
      </div>

      {/* DragDropContext only after hydration to avoid SSR mismatch */}
      {mounted ? <DragDropContext onDragEnd={onDragEnd}>{board}</DragDropContext> : board}

      {selected && (
        <BriefDrawer
          brief={selected}
          clientColor={selected.client_color}
          clientName={selected.client_name}
          onClose={() => setSelected(null)}
          onMove={moveClient}
          onInternalMove={moveInternal}
          onRefresh={load}
          internalMode
        />
      )}
    </div>
  )
}
