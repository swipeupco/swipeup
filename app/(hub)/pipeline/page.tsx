'use client'

/**
 * Master Production Pipeline — cross-client view.
 *
 * 4 columns: Backlog, In Production, Ready for Review, Approved.
 * Cards are the Portal's BriefCard with `showClientChip` enabled so each
 * card prepends a client logo + name row (the per-client board doesn't need
 * this because the active client is implicit from the URL).
 *
 * Backlog rule: every brief where pipeline_status='in_production' on any
 * client portal surfaces here. Hub Backlog = client portal "In Production".
 */

export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState } from 'react'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'
import { Search, User, Clock } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  Brief, BriefCard, BriefPanel,
} from '@/components/pipeline/PortalBoard'

type ColumnKey = 'backlog' | 'in_production' | 'ready_for_review' | 'approved'

const COLUMNS: Array<{ key: ColumnKey; label: string; dot: string; empty: string }> = [
  { key: 'backlog',          label: 'Backlog',          dot: 'bg-amber-400',   empty: 'Nothing in backlog' },
  { key: 'in_production',    label: 'In Production',    dot: 'bg-blue-400',    empty: 'No active work' },
  { key: 'ready_for_review', label: 'Ready for Review', dot: 'bg-violet-400',  empty: 'No drafts ready' },
  { key: 'approved',         label: 'Approved',         dot: 'bg-emerald-400', empty: 'Nothing approved yet' },
]

/** Map a brief onto its Hub column. Matches the Pass-1.5 Issue-4 fix:
 *  Backlog is the default bucket for any Portal-created brief with
 *  pipeline_status='in_production' that hasn't been moved through Hub
 *  stages yet. It leaves Backlog the moment an "active" signal fires. */
function columnFor(b: Brief): ColumnKey {
  if (b.pipeline_status === 'approved') return 'approved'
  if (b.internal_status === 'approved_by_client') return 'approved'
  if (b.pipeline_status === 'client_review') return 'ready_for_review'
  if (b.internal_status === 'in_review') return 'ready_for_review'
  if (b.internal_status === 'revisions_required') return 'in_production'
  if (b.draft_url) return 'in_production'
  return 'backlog'
}

function dbStatusForColumn(col: ColumnKey): { pipeline_status: string; internal_status: string } {
  switch (col) {
    case 'backlog':          return { pipeline_status: 'in_production', internal_status: 'in_production' }
    case 'in_production':    return { pipeline_status: 'in_production', internal_status: 'in_production' }
    case 'ready_for_review': return { pipeline_status: 'client_review', internal_status: 'in_review' }
    case 'approved':         return { pipeline_status: 'approved',      internal_status: 'approved_by_client' }
  }
}

interface HubStaffLite { id: string; name: string | null; avatar_url: string | null; email: string | null }

export default function InternalPipeline() {
  const [briefs, setBriefs] = useState<Brief[]>([])
  const [hubStaff, setHubStaff] = useState<HubStaffLite[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [selected, setSelected] = useState<Brief | null>(null)

  const [query, setQuery] = useState('')
  const [myOnly, setMyOnly] = useState(false)
  const [unassignedOnly, setUnassignedOnly] = useState(false)
  const [awaitingClient, setAwaitingClient] = useState(false)

  async function load(silent = false) {
    if (!silent) setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) setCurrentUserId(user.id)

    const [{ data: profile }, { data: briefData }, { data: staffData }, { data: clientData }] = await Promise.all([
      user
        ? supabase.from('profiles').select('is_admin, hub_role').eq('id', user.id).single()
        : Promise.resolve({ data: null }),
      supabase
        .from('briefs')
        .select('*')
        .in('pipeline_status', ['in_production', 'qa_review', 'client_review', 'approved'])
        .order('created_at', { ascending: false }),
      supabase
        .from('profiles')
        .select('id, name, avatar_url, email')
        .or('hub_role.eq.admin,hub_role.eq.designer,is_staff.eq.true,is_admin.eq.true'),
      supabase
        .from('clients')
        .select('id, name, color, logo_url'),
    ])

    const p = profile as { is_admin?: boolean; hub_role?: string | null } | null
    setIsAdmin(p?.hub_role === 'admin' || p?.is_admin === true)
    const staffList = (staffData as HubStaffLite[]) ?? []
    setHubStaff(staffList)

    const all = (briefData ?? []) as Brief[]
    if (!all.length) { setBriefs([]); setLoading(false); return }

    const clientMap: Record<string, { name: string; color: string; logo_url: string | null }> = {}
    ;(clientData ?? []).forEach((c: { id: string; name: string; color: string; logo_url: string | null }) => {
      clientMap[c.id] = { name: c.name, color: c.color, logo_url: c.logo_url }
    })

    const briefIds   = all.map(b => b.id)
    const creatorIds = [...new Set(all.map(b => b.created_by).filter(Boolean))] as string[]
    const assigneeIds = [...new Set(all.map(b => b.assigned_to).filter(Boolean))] as string[]

    const [tagsRes, profileRes] = await Promise.all([
      briefIds.length
        ? supabase.from('brief_assigned_users').select('brief_id, user_id').in('brief_id', briefIds)
        : Promise.resolve({ data: [] as { brief_id: string; user_id: string }[] }),
      (creatorIds.length || assigneeIds.length)
        ? supabase.from('profiles').select('id, name, avatar_url').in('id', [...new Set([...creatorIds, ...assigneeIds])])
        : Promise.resolve({ data: [] as { id: string; name: string | null; avatar_url: string | null }[] }),
    ])

    const tagRows = (tagsRes.data ?? []) as { brief_id: string; user_id: string }[]
    const profileMap: Record<string, { id: string; name: string | null; avatar_url: string | null }> = {}
    ;((profileRes.data ?? []) as { id: string; name: string | null; avatar_url: string | null }[]).forEach(p => {
      profileMap[p.id] = p
    })

    // Also fetch any profiles needed for tagged users
    const taggedIds = [...new Set(tagRows.map(r => r.user_id))]
    const missing = taggedIds.filter(id => !profileMap[id])
    if (missing.length) {
      const { data: extra } = await supabase.from('profiles').select('id, name, avatar_url').in('id', missing)
      ;(extra ?? []).forEach(p => {
        const typed = p as { id: string; name: string | null; avatar_url: string | null }
        profileMap[typed.id] = typed
      })
    }

    const enriched: Brief[] = all.map(b => {
      const client = clientMap[b.client_id]
      return {
        ...b,
        creator: b.created_by ? profileMap[b.created_by] ?? null : null,
        assigned_designer: b.assigned_to ? profileMap[b.assigned_to] ?? null : null,
        tagged_users: tagRows
          .filter(r => r.brief_id === b.id)
          .map(r => profileMap[r.user_id])
          .filter(Boolean),
        client_name:  client?.name ?? 'Unknown',
        client_color: client?.color ?? '#4950F8',
        client_logo:  client?.logo_url ?? null,
      }
    })
    setBriefs(enriched)
    setSelected(prev => prev ? enriched.find(b => b.id === prev.id) ?? null : null)
    setLoading(false)
  }

  useEffect(() => {
    load()
    const supabase = createClient()
    const channel = supabase
      .channel('hub-pipeline-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'briefs' }, () => load(true))
      .subscribe()
    return () => { supabase.removeChannel(channel) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return briefs.filter(b => {
      if (q) {
        const matches =
          b.name.toLowerCase().includes(q) ||
          (b.client_name?.toLowerCase().includes(q) ?? false) ||
          (b.assigned_designer?.name?.toLowerCase().includes(q) ?? false)
        if (!matches) return false
      }
      if (myOnly && b.assigned_to !== currentUserId) return false
      if (unassignedOnly && b.assigned_to) return false
      if (awaitingClient && b.pipeline_status !== 'client_review') return false
      return true
    })
  }, [briefs, query, myOnly, unassignedOnly, awaitingClient, currentUserId])

  const byColumn = useMemo(() => {
    const out: Record<ColumnKey, Brief[]> = { backlog: [], in_production: [], ready_for_review: [], approved: [] }
    for (const b of filtered) out[columnFor(b)].push(b)
    return out
  }, [filtered])

  const myCount         = useMemo(() => briefs.filter(b => b.assigned_to === currentUserId).length, [briefs, currentUserId])
  const unassignedCount = useMemo(() => briefs.filter(b => !b.assigned_to && b.pipeline_status !== 'approved').length, [briefs])
  const awaitingCount   = useMemo(() => briefs.filter(b => b.pipeline_status === 'client_review').length, [briefs])

  async function moveToColumn(briefId: string, target: ColumnKey) {
    const brief = briefs.find(b => b.id === briefId)
    if (!brief) return
    if (!isAdmin && brief.assigned_to !== currentUserId) return

    const { pipeline_status, internal_status } = dbStatusForColumn(target)
    setBriefs(prev => prev.map(b => b.id === briefId ? { ...b, pipeline_status, internal_status } : b))
    if (selected?.id === briefId) setSelected(prev => prev ? { ...prev, pipeline_status, internal_status } : null)
    const supabase = createClient()
    await supabase.from('briefs').update({ pipeline_status, internal_status }).eq('id', briefId)
  }

  async function onDragEnd(result: DropResult) {
    const { destination, draggableId } = result
    if (!destination) return
    const target = destination.droppableId as ColumnKey
    const brief = briefs.find(b => b.id === draggableId)
    if (!brief) return
    if (columnFor(brief) === target) return
    await moveToColumn(draggableId, target)
  }

  async function handleAssignDesigner(briefId: string, staffId: string | null) {
    const supabase = createClient()
    await supabase.from('briefs').update({ assigned_to: staffId }).eq('id', briefId)
    const designer = staffId ? hubStaff.find(s => s.id === staffId) ?? null : null
    setBriefs(prev => prev.map(b => b.id === briefId ? {
      ...b,
      assigned_to: staffId,
      assigned_designer: designer ? { id: designer.id, name: designer.name, avatar_url: designer.avatar_url } : null,
    } : b))
    setSelected(prev => prev?.id === briefId ? {
      ...prev,
      assigned_to: staffId,
      assigned_designer: designer ? { id: designer.id, name: designer.name, avatar_url: designer.avatar_url } : null,
    } : prev)
  }

  async function handleApprove(briefId: string) {
    const supabase = createClient()
    await supabase.from('briefs')
      .update({ pipeline_status: 'approved', internal_status: 'approved_by_client' })
      .eq('id', briefId)
    setBriefs(prev => prev.map(b => b.id === briefId
      ? { ...b, pipeline_status: 'approved', internal_status: 'approved_by_client' }
      : b))
    if (selected?.id === briefId) {
      setSelected(prev => prev ? { ...prev, pipeline_status: 'approved', internal_status: 'approved_by_client' } : null)
    }
  }

  async function handleRequestRevisions(briefId: string) {
    const supabase = createClient()
    await supabase.from('briefs')
      .update({ pipeline_status: 'client_review', internal_status: 'revisions_required' })
      .eq('id', briefId)
    setBriefs(prev => prev.map(b => b.id === briefId
      ? { ...b, pipeline_status: 'client_review', internal_status: 'revisions_required' }
      : b))
    if (selected?.id === briefId) {
      setSelected(prev => prev ? { ...prev, pipeline_status: 'client_review', internal_status: 'revisions_required' } : null)
    }
  }

  async function handleCoverUpload(briefId: string, file: File | null) {
    if (!file) return
    const supabase = createClient()
    const path = `brief-covers/${briefId}.jpg`
    const { error: uploadError } = await supabase.storage.from('brief-assets').upload(path, file, { upsert: true, contentType: file.type })
    if (uploadError) { alert(uploadError.message); return }
    const { data: { publicUrl } } = supabase.storage.from('brief-assets').getPublicUrl(path)
    const bustedUrl = `${publicUrl}?t=${Date.now()}`
    await supabase.from('briefs').update({ cover_url: bustedUrl }).eq('id', briefId)
    setBriefs(prev => prev.map(b => b.id === briefId ? { ...b, cover_url: bustedUrl } : b))
    setSelected(prev => prev?.id === briefId ? { ...prev, cover_url: bustedUrl } : prev)
  }

  async function handleCoverDelete(briefId: string) {
    const supabase = createClient()
    await supabase.storage.from('brief-assets').remove([`brief-covers/${briefId}.jpg`])
    await supabase.from('briefs').update({ cover_url: null }).eq('id', briefId)
    setBriefs(prev => prev.map(b => b.id === briefId ? { ...b, cover_url: null } : b))
    setSelected(prev => prev?.id === briefId ? { ...prev, cover_url: null } : prev)
  }

  return (
    // pipeline-bg: radial gradient from bottom-left (brand violet) on a deep
    // near-black base in dark mode, subtle same-recipe variant in light mode.
    // See app/globals.css.
    <div className="pipeline-bg min-h-[calc(100vh-3.5rem)] text-gray-900 dark:text-white">
      <div className="p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Production Pipeline</h1>
            <p className="text-sm text-gray-400 mt-0.5">
              {briefs.length} brief{briefs.length !== 1 ? 's' : ''} across {Object.keys(new Set(briefs.map(b => b.client_id))).length || 0} client{briefs.length !== 1 ? 's' : ''} · {filtered.length} shown
            </p>
          </div>
        </div>

        {/* Search + filter chips */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 max-w-md min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search briefs, clients, designers..."
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-gray-700 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-200 dark:focus:ring-violet-400/30 focus:border-violet-300 dark:focus:border-violet-400"
            />
          </div>
          <FilterChip active={myOnly} onClick={() => setMyOnly(v => !v)} icon={<User className="h-3.5 w-3.5" />} label="My briefs" count={myCount} />
          <FilterChip active={unassignedOnly} onClick={() => setUnassignedOnly(v => !v)} icon={<User className="h-3.5 w-3.5" />} label="Unassigned" count={unassignedCount} />
          <FilterChip active={awaitingClient} onClick={() => setAwaitingClient(v => !v)} icon={<Clock className="h-3.5 w-3.5" />} label="Awaiting client review" count={awaitingCount} />
        </div>

        {/* Board — Trello-style: fixed-width columns (272px each), horizontal
            scroll on the board container when columns overflow, vertical scroll
            inside each column when its card list overflows. */}
        {loading ? (
          <div className="flex gap-3 overflow-x-auto pb-2">
            {[1,2,3,4].map(n => <div key={n} className="flex-shrink-0 w-[272px] h-96 rounded-2xl bg-gray-200 dark:bg-white/5 animate-pulse" />)}
          </div>
        ) : (
          <DragDropContext onDragEnd={onDragEnd}>
            <div className="flex gap-3 items-start overflow-x-auto pb-2">
              {COLUMNS.map(col => {
                const colBriefs = byColumn[col.key] ?? []
                return (
                  <div
                    key={col.key}
                    className="flex-shrink-0 w-[272px] flex flex-col max-h-[calc(100vh-14rem)] bg-white dark:bg-[#0F1420] rounded-2xl border border-gray-100 dark:border-white/[0.08] shadow-sm dark:shadow-none overflow-hidden"
                  >
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50 dark:border-white/[0.06] flex-shrink-0">
                      <div className="flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full flex-shrink-0 ${col.dot}`} />
                        <h3 className="text-sm font-semibold text-gray-800 dark:text-slate-100">{col.label}</h3>
                        <span className="text-[11px] font-medium text-gray-400 dark:text-zinc-400 bg-gray-100 dark:bg-white/10 rounded-full px-2 py-0.5">
                          {colBriefs.length}
                        </span>
                      </div>
                      <div className="h-7 w-7" />
                    </div>
                    <Droppable droppableId={col.key}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          className={`flex-1 overflow-y-auto p-3 space-y-3 min-h-[200px] transition-colors ${snapshot.isDraggingOver ? 'bg-violet-50/50 dark:bg-violet-500/10' : ''}`}
                        >
                          {colBriefs.map((brief, index) => (
                            <Draggable key={brief.id} draggableId={brief.id} index={index}>
                              {(dragProvided, dragSnapshot) => (
                                <div
                                  ref={dragProvided.innerRef}
                                  {...dragProvided.draggableProps}
                                  style={dragProvided.draggableProps.style}
                                >
                                  <BriefCard
                                    brief={brief}
                                    clientColor={brief.client_color ?? '#4950F8'}
                                    reviewMode={col.key === 'ready_for_review'}
                                    showClientChip
                                    dragHandleProps={dragProvided.dragHandleProps}
                                    isDragging={dragSnapshot.isDragging}
                                    onOpen={() => !dragSnapshot.isDragging && setSelected(brief)}
                                    onApprove={() => handleApprove(brief.id)}
                                    onRequestRevisions={() => handleRequestRevisions(brief.id)}
                                    onCoverUpload={(file) => handleCoverUpload(brief.id, file)}
                                    onCoverDelete={() => handleCoverDelete(brief.id)}
                                  />
                                </div>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                          {colBriefs.length === 0 && (
                            <div className="rounded-2xl border border-dashed border-gray-200 dark:border-white/[0.08] bg-gray-50/50 dark:bg-white/[0.02] py-12 text-center">
                              <p className="text-xs text-gray-400 dark:text-zinc-500">{col.empty}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </Droppable>
                  </div>
                )
              })}
            </div>
          </DragDropContext>
        )}

        {/* Brief drawer */}
        {selected && (
          <BriefPanel
            brief={selected}
            clientColor={selected.client_color ?? '#4950F8'}
            showInternalNotesTab
            hubStaff={hubStaff}
            onAssignDesigner={handleAssignDesigner}
            onClose={() => setSelected(null)}
            onApprove={() => handleApprove(selected.id)}
            onRequestRevisions={() => handleRequestRevisions(selected.id)}
            onCoverUpload={(file) => handleCoverUpload(selected.id, file)}
            onCoverDelete={() => handleCoverDelete(selected.id)}
            onReload={() => load(true)}
          />
        )}
      </div>
    </div>
  )
}

function FilterChip({
  active, onClick, icon, label, count,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
  count: number
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold border transition-colors ${
        active
          ? 'bg-violet-50 dark:bg-violet-500/15 border-violet-200 dark:border-violet-400/30 text-violet-700 dark:text-violet-300'
          : 'border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-gray-600 dark:text-zinc-300 hover:text-gray-800 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-white/10'
      }`}
    >
      {icon}
      {label}
      <span className={`rounded-full text-[10px] font-bold px-1.5 py-0.5 ${
        active ? 'bg-violet-600 text-white' : 'bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-zinc-300'
      }`}>
        {count}
      </span>
    </button>
  )
}
