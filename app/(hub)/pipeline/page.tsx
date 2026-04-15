'use client'

import { useEffect, useState, useRef } from 'react'
import {
  Video, Image, Mail, LayoutGrid, Mic, FileText, CircleDot,
  User, Loader2, X, Check, ChevronDown, ExternalLink, Clock, AlertTriangle, ArrowRight,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { format } from 'date-fns'
import { BriefDrawer } from '@/components/pipeline/BriefDrawer'
import { INTERNAL_STAGES } from '@/lib/pipeline/stages'

// ─── Content Types ────────────────────────────────────────────────────────────

const CONTENT_TYPES = [
  { id: 'Video',     icon: Video,      color: '#22c55e' },
  { id: 'Graphic',   icon: Image,      color: '#f97316' },
  { id: 'EDM',       icon: Mail,       color: '#ef4444' },
  { id: 'Signage',   icon: LayoutGrid, color: '#0ea5e9' },
  { id: 'Voiceover', icon: Mic,        color: '#a855f7' },
  { id: 'Script',    icon: FileText,   color: '#f59e0b' },
  { id: 'Other',     icon: CircleDot,  color: '#94a3b8' },
]

// ─── Interfaces ───────────────────────────────────────────────────────────────

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function stageFor(b: PipelineBrief): string {
  const s = b.internal_status ?? ''
  if (INTERNAL_STAGES.find(st => st.key === s)) return s
  // Legacy mapping
  if (s === 'ready_for_review') return 'in_review'
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
            {clients.map(client => {
              const assignedId = assignments[client.id] ?? null
              return (
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
                    value={assignedId ?? ''}
                    onChange={e => onSet(client.id, e.target.value || null)}
                    className="text-[11px] text-zinc-600 border border-zinc-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-300"
                  >
                    <option value="">Unassigned</option>
                    {staff.map(s => (
                      <option key={s.id} value={s.id}>{s.name ?? s.email}</option>
                    ))}
                  </select>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Pipeline Card ────────────────────────────────────────────────────────────

function PipelineCard({ brief, staff, isAdmin, onClick, onAssign, onPushToClient }: {
  brief: PipelineBrief
  staff: StaffMember[]
  isAdmin: boolean
  onClick: () => void
  onAssign: (userId: string | null) => void
  onPushToClient: () => void
}) {
  const typeInfo = CONTENT_TYPES.find(t => t.id === brief.content_type)
  const alreadySent = brief.pipeline_status === 'client_review' || brief.pipeline_status === 'approved'

  return (
    <div
      onClick={onClick}
      className="rounded-2xl bg-white border border-zinc-100 shadow-sm hover:shadow-md transition-all cursor-pointer"
    >
      {/* Cover or accent bar */}
      {brief.cover_url ? (
        <div className="h-24 rounded-t-2xl overflow-hidden">
          <img src={brief.cover_url} alt="" className="w-full h-full object-cover" />
        </div>
      ) : (
        <div className="h-1.5 rounded-t-2xl" style={{ backgroundColor: brief.client_color }} />
      )}

      <div className="p-3">
        {/* Client logo + name + assignee */}
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

        {/* Content type badge */}
        {typeInfo && (
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold mb-1.5"
            style={{ backgroundColor: `${typeInfo.color}18`, color: typeInfo.color }}
          >
            <typeInfo.icon className="h-2.5 w-2.5" />
            {typeInfo.id}
          </span>
        )}

        {/* Brief name */}
        <p className="text-xs font-semibold text-zinc-800 leading-snug mb-2">{brief.name}</p>

        {/* Due date */}
        {brief.due_date && (
          <span className="flex items-center gap-1 text-[10px] text-zinc-400 mb-2">
            <Clock className="h-2.5 w-2.5" />
            {format(new Date(brief.due_date), 'd MMM')}
          </span>
        )}

        {/* View draft + Push to client buttons — only when a link exists */}
        {!alreadySent && brief.draft_url && (
          <div className="flex gap-1.5 mt-1" onClick={e => e.stopPropagation()}>
            <a
              href={brief.draft_url ?? '#'}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => { if (!brief.draft_url) e.preventDefault() }}
              className={`flex-1 flex items-center justify-center gap-1 rounded-lg py-1.5 text-[11px] font-semibold text-white bg-blue-500 hover:opacity-90 transition-opacity ${!brief.draft_url ? 'opacity-30 pointer-events-none' : ''}`}
            >
              <ExternalLink className="h-3 w-3" />
              View draft
            </a>
            <button
              onClick={e => { e.stopPropagation(); onPushToClient() }}
              disabled={!brief.draft_url}
              className="flex-1 flex items-center justify-center gap-1 rounded-lg py-1.5 text-[11px] font-semibold text-white bg-emerald-500 hover:opacity-90 disabled:opacity-30 transition-opacity"
            >
              Push to client
              <ArrowRight className="h-3 w-3" />
            </button>
          </div>
        )}

        {/* Sent / approved state */}
        {alreadySent && brief.draft_url && (
          <div className="flex gap-1.5 mt-1" onClick={e => e.stopPropagation()}>
            <a
              href={brief.draft_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-1 rounded-lg py-1.5 text-[11px] font-semibold text-white bg-blue-500 hover:opacity-90 transition-opacity"
            >
              <ExternalLink className="h-3 w-3" />
              View draft
            </a>
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

  async function load() {
    const supabase = createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      setCurrentUserId(user.id)
      const { data: profile } = await supabase
        .from('profiles').select('is_admin').eq('id', user.id).single()
      setIsAdmin(profile?.is_admin ?? false)
    }

    const { data: briefData } = await supabase
      .from('briefs')
      .select('*')
      .eq('pipeline_status', 'in_production')
      .not('internal_status', 'is', null)
      .order('created_at', { ascending: false })

    if (!briefData?.length) { setBriefs([]); setLoading(false); return }

    const clientIds = [...new Set(briefData.map((b: { client_id: string }) => b.client_id))]
    const { data: clientData } = await supabase
      .from('clients')
      .select('id, name, color, logo_url')
      .in('id', clientIds)

    const assigneeIds = [
      ...new Set(
        briefData
          .map((b: { assigned_to?: string | null }) => b.assigned_to)
          .filter((id): id is string => !!id)
      ),
    ]
    let assigneeData: { id: string; name: string | null; avatar_url: string | null }[] = []
    if (assigneeIds.length > 0) {
      const { data } = await supabase.from('profiles').select('id, name, avatar_url').in('id', assigneeIds)
      assigneeData = data ?? []
    }

    const enriched: PipelineBrief[] = briefData.map((b: Record<string, unknown>) => {
      const client   = clientData?.find((c: { id: string }) => c.id === b.client_id)
      const assignee = assigneeData.find(p => p.id === b.assigned_to)
      return {
        ...b,
        client_name:     (client as { name?: string })?.name    ?? 'Unknown',
        client_color:    (client as { color?: string })?.color   ?? '#6366f1',
        client_logo:     (client as { logo_url?: string | null })?.logo_url ?? null,
        assignee_name:   assignee?.name         ?? null,
        assignee_avatar: assignee?.avatar_url   ?? null,
      } as PipelineBrief
    })
    setBriefs(enriched)

    const { data: staffData } = await supabase
      .from('profiles')
      .select('id, name, avatar_url, email')
      .or('is_staff.eq.true,is_admin.eq.true')
    setStaff((staffData as StaffMember[]) ?? [])

    const { data: caData } = await supabase
      .from('client_assignments')
      .select('client_id, assigned_to')
    const caMap: Record<string, string> = {}
    caData?.forEach((ca: { client_id: string; assigned_to: string }) => { caMap[ca.client_id] = ca.assigned_to })
    setClientAssignments(caMap)

    setLoading(false)
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
    const supabase = createClient()
    const updates: Record<string, string> = { internal_status: newStatus }
    if (newStatus === 'approved_by_client') updates.pipeline_status = 'approved'
    await supabase.from('briefs').update(updates).eq('id', briefId)
    setBriefs(prev => prev.map(b => b.id === briefId ? { ...b, ...updates } : b))
    setSelected(prev => prev?.id === briefId ? { ...prev, ...updates } as PipelineBrief : prev)
  }

  async function moveClient(briefId: string, newStage: string) {
    const supabase = createClient()
    await supabase.from('briefs').update({ pipeline_status: newStage }).eq('id', briefId)
    setBriefs(prev => prev.map(b => b.id === briefId ? { ...b, pipeline_status: newStage } : b))
    setSelected(prev => prev?.id === briefId ? { ...prev, pipeline_status: newStage } as PipelineBrief : prev)
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
    const supabase = createClient()
    await supabase.from('briefs').update({
      pipeline_status: 'client_review',
      internal_status: 'in_review',
    }).eq('id', briefId)
    setBriefs(prev => prev.map(b => b.id === briefId
      ? { ...b, pipeline_status: 'client_review', internal_status: 'in_review' }
      : b
    ))
  }

  async function setClientDefault(clientId: string, userId: string | null) {
    const supabase = createClient()
    if (!userId) {
      await supabase.from('client_assignments').delete().eq('client_id', clientId)
      setClientAssignments(prev => { const n = { ...prev }; delete n[clientId]; return n })
    } else {
      await supabase.from('client_assignments').upsert(
        { client_id: clientId, assigned_to: userId },
        { onConflict: 'client_id' },
      )
      setClientAssignments(prev => ({ ...prev, [clientId]: userId }))
      setBriefs(prev => prev.map(b =>
        b.client_id === clientId && !b.assigned_to
          ? { ...b, assigned_to: userId, assignee_name: staff.find(s => s.id === userId)?.name ?? null }
          : b
      ))
    }
  }

  const filtered    = myBriefsOnly ? briefs.filter(b => b.assigned_to === currentUserId) : briefs
  const byStage     = INTERNAL_STAGES.reduce((acc, stage) => {
    acc[stage.key]  = filtered.filter(b => stageFor(b) === stage.key)
    return acc
  }, {} as Record<string, PipelineBrief[]>)

  const uniqueClients: ClientRow[] = [
    ...new Map(briefs.map(b => [b.client_id, {
      id: b.client_id, name: b.client_name, color: b.client_color, logo: b.client_logo,
    }])).values(),
  ]

  const revisionsCount = briefs.filter(b => stageFor(b) === 'revisions_required').length

  if (loading) return (
    <div className="flex items-center justify-center h-[60vh]">
      <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
    </div>
  )

  return (
    <div className="p-6 space-y-5">

      {/* Header */}
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

      {/* Kanban board */}
      <div className="grid grid-cols-4 gap-4 items-start">
        {INTERNAL_STAGES.map(stage => (
          <div
            key={stage.key}
            className="rounded-2xl overflow-hidden border border-zinc-100"
            style={{ backgroundColor: stage.bgColor }}
          >
            {/* Column header */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-black/5">
              <span
                className="h-2 w-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: stage.dotColor }}
              />
              <h3 className="text-sm font-semibold text-zinc-800 flex-1">{stage.label}</h3>
              <span
                className="text-[11px] font-bold rounded-full px-2 py-0.5"
                style={{ backgroundColor: `${stage.dotColor}22`, color: stage.dotColor }}
              >
                {byStage[stage.key].length}
              </span>
            </div>

            {/* Cards */}
            <div className="p-3 space-y-3 min-h-[160px]">
              {byStage[stage.key].map(brief => (
                <PipelineCard
                  key={brief.id}
                  brief={brief}
                  staff={staff}
                  isAdmin={isAdmin}
                  onClick={() => setSelected(brief)}
                  onAssign={uid => assignBrief(brief.id, uid)}
                  onPushToClient={() => pushBriefToClient(brief.id)}
                />
              ))}
              {byStage[stage.key].length === 0 && (
                <div className="rounded-xl border border-dashed border-zinc-200 py-10 text-center">
                  <p className="text-xs text-zinc-400">Nothing here</p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Brief detail drawer */}
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
