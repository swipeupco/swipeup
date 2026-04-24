'use client'

/**
 * Per-client board — 3 columns matching the Hub's master pipeline:
 *   In Production · Ready for Review · Approved
 *
 * The Portal owns the Backlog concept; briefs with pipeline_status='backlog'
 * only show on the Portal side and are filtered out of this board. Any time
 * a slot in In Production opens up, the DB-side auto_promote_backlog()
 * function (migration 007) takes care of promoting the next backlog brief
 * per the client's in_production_limit.
 *
 * Hub-only overlays:
 *   - Sticky header with "Back" button and "Client portal" link.
 *   - BriefCard shows a tiny assigned-designer chip on the bottom row.
 *   - BriefPanel exposes an "Internal" comments tab (is_internal=true) and
 *     an "Assigned designer" picker that writes to briefs.assigned_to.
 *   - "With client" blue pill on a card when pipeline_status='client_review'.
 */

export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState, use } from 'react'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'
import { Plus, ChevronDown, ArrowLeft, ExternalLink, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import {
  Brief, BriefCard, ApprovedBriefCard, BriefPanel, CreateBriefModal,
} from '@/components/pipeline/PortalBoard'

interface Client { id: string; name: string; slug: string; color: string; logo_url: string | null }
interface HubStaffLite { id: string; name: string | null; avatar_url: string | null; email: string | null }

type ColumnKey = 'in_production' | 'ready_for_review' | 'approved'

const COLUMNS: Array<{ key: ColumnKey; label: string; dot: string; empty: string }> = [
  { key: 'in_production',    label: 'In Production',    dot: 'bg-blue-400',    empty: 'Nothing in production' },
  { key: 'ready_for_review', label: 'Ready for Review', dot: 'bg-violet-400',  empty: 'No drafts to review' },
  { key: 'approved',         label: 'Approved',         dot: 'bg-emerald-400', empty: 'No approved briefs yet' },
]

/** Column resolution — Hub has 3 columns. Portal Backlog briefs
 *  (pipeline_status='backlog') are filtered before this ever runs.
 *
 *  INVARIANT (same as master pipeline): column placement is derived from
 *  pipeline_status and internal_status ONLY. Draft URL presence
 *  (brief.draft_url) MUST NOT affect which column a brief renders in —
 *  clearing a draft link is a metadata edit, not a status transition.
 */
function columnFor(b: Brief): ColumnKey {
  if (b.pipeline_status === 'approved') return 'approved'
  if (b.internal_status === 'approved_by_client') return 'approved'
  if (b.pipeline_status === 'client_review') return 'ready_for_review'
  if (b.internal_status === 'in_review') return 'ready_for_review'
  return 'in_production'
}

function dbStatusForColumn(col: ColumnKey): { pipeline_status: string; internal_status: string } {
  switch (col) {
    case 'in_production':    return { pipeline_status: 'in_production', internal_status: 'in_production' }
    case 'ready_for_review': return { pipeline_status: 'client_review', internal_status: 'in_review' }
    case 'approved':         return { pipeline_status: 'approved',      internal_status: 'approved_by_client' }
  }
}

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'portal.swipeupco.com'

export default function ClientPipeline({ params }: { params: Promise<{ clientSlug: string }> }) {
  const { clientSlug } = use(params)
  const router = useRouter()

  const [client, setClient]           = useState<Client | null>(null)
  const [briefs, setBriefs]           = useState<Brief[]>([])
  const [hubStaff, setHubStaff]       = useState<HubStaffLite[]>([])
  const [loading, setLoading]         = useState(true)
  const [selectedBrief, setSelectedBrief] = useState<Brief | null>(null)
  const [showBriefModal, setShowBriefModal] = useState(false)
  const [showAllApproved, setShowAllApproved] = useState(false)

  async function load(silent = false) {
    if (!silent) setLoading(true)
    const supabase = createClient()

    const { data: clientData } = await supabase
      .from('clients').select('*').eq('slug', clientSlug).single()
    if (!clientData) { setLoading(false); return }
    setClient(clientData)

    const [{ data: briefData }, { data: staffData }] = await Promise.all([
      // Hub excludes Portal-backlog briefs — those only surface on the Portal.
      supabase
        .from('briefs')
        .select('*')
        .eq('client_id', clientData.id)
        .neq('pipeline_status', 'backlog')
        .order('sort_order', { ascending: true }),
      supabase
        .from('profiles')
        .select('id, name, avatar_url, email')
        .or('hub_role.eq.admin,hub_role.eq.designer,is_staff.eq.true,is_admin.eq.true'),
    ])

    const all = (briefData ?? []) as Brief[]
    setHubStaff((staffData as HubStaffLite[]) ?? [])

    // Enrich with creator, tagged_users, and the Hub's assigned_designer.
    const briefIds   = all.map(b => b.id)
    const creatorIds = [...new Set(all.map(b => b.created_by).filter(Boolean))] as string[]
    const assigneeIds = [...new Set(all.map(b => b.assigned_to).filter(Boolean))] as string[]

    const [tagsRes, creatorsRes] = await Promise.all([
      briefIds.length
        ? supabase.from('brief_assigned_users').select('brief_id, user_id').in('brief_id', briefIds)
        : Promise.resolve({ data: [] as { brief_id: string; user_id: string }[] }),
      creatorIds.length
        ? supabase.from('profiles').select('id, name, avatar_url').in('id', creatorIds)
        : Promise.resolve({ data: [] as { id: string; name: string | null; avatar_url: string | null }[] }),
    ])

    const tagRows = (tagsRes.data ?? []) as { brief_id: string; user_id: string }[]
    const taggedIds = [...new Set(tagRows.map(r => r.user_id))]
    const allProfileIds = [...new Set([...creatorIds, ...taggedIds, ...assigneeIds])]

    const profileMap: Record<string, { id: string; name: string | null; avatar_url: string | null }> = {}
    const seed = (creatorsRes.data ?? []) as { id: string; name: string | null; avatar_url: string | null }[]
    seed.forEach(p => { profileMap[p.id] = p })
    const missing = allProfileIds.filter(id => !profileMap[id])
    if (missing.length) {
      const { data: extra } = await supabase.from('profiles').select('id, name, avatar_url').in('id', missing)
      ;(extra ?? []).forEach(p => { profileMap[p.id] = p })
    }

    const enriched = all.map(b => ({
      ...b,
      creator: b.created_by ? profileMap[b.created_by] ?? null : null,
      tagged_users: tagRows
        .filter(r => r.brief_id === b.id)
        .map(r => profileMap[r.user_id])
        .filter(Boolean),
      assigned_designer: b.assigned_to ? profileMap[b.assigned_to] ?? null : null,
    }))

    setBriefs(enriched)
    setSelectedBrief(prev => prev ? enriched.find(b => b.id === prev.id) ?? null : null)
    setLoading(false)
  }

  useEffect(() => {
    load()
    const supabase = createClient()
    const channel = supabase
      .channel(`client-briefs-${clientSlug}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'briefs' }, () => load(true))
      .subscribe()
    return () => { supabase.removeChannel(channel) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientSlug])

  const byColumn = useMemo(() => {
    const out: Record<ColumnKey, Brief[]> = { in_production: [], ready_for_review: [], approved: [] }
    for (const b of briefs) out[columnFor(b)].push(b)
    return out
  }, [briefs])

  async function moveToColumn(briefId: string, target: ColumnKey) {
    const { pipeline_status, internal_status } = dbStatusForColumn(target)
    setBriefs(prev => prev.map(b => b.id === briefId ? { ...b, pipeline_status, internal_status } : b))
    if (selectedBrief?.id === briefId) {
      setSelectedBrief(prev => prev ? { ...prev, pipeline_status, internal_status } : null)
    }
    const supabase = createClient()
    await supabase.from('briefs').update({ pipeline_status, internal_status }).eq('id', briefId)
  }

  async function handleDragEnd(result: DropResult) {
    const { destination, draggableId } = result
    if (!destination) return
    const target = destination.droppableId as ColumnKey
    const brief = briefs.find(b => b.id === draggableId)
    if (!brief) return
    if (columnFor(brief) === target) return
    await moveToColumn(draggableId, target)
  }

  async function handleApprove(briefId: string) {
    // Approve is retained here for BriefPanel backward compat, but the Hub
    // drawer no longer shows an Approve button (clients approve, not us).
    // DB trigger (migration 007) auto-promotes the next backlog brief into
    // the vacated In Production slot.
    const supabase = createClient()
    await supabase
      .from('briefs')
      .update({ pipeline_status: 'approved', internal_status: 'approved_by_client' })
      .eq('id', briefId)
    setBriefs(prev => prev.map(b =>
      b.id === briefId ? { ...b, pipeline_status: 'approved', internal_status: 'approved_by_client' } : b
    ))
    if (selectedBrief?.id === briefId) {
      setSelectedBrief(prev => prev ? { ...prev, pipeline_status: 'approved', internal_status: 'approved_by_client' } : null)
    }
  }

  async function handleRequestRevisions(briefId: string) {
    // Hub QA pulls the brief back from Ready for Review into In Production.
    // Never pings the client — internal only. If the brief was already
    // pushed (pipeline_status='client_review') we also clear that so
    // Portal doesn't keep it in its own review queue.
    const supabase = createClient()
    await supabase
      .from('briefs')
      .update({ pipeline_status: 'in_production', internal_status: 'in_production' })
      .eq('id', briefId)
    setBriefs(prev => prev.map(b =>
      b.id === briefId ? { ...b, pipeline_status: 'in_production', internal_status: 'in_production' } : b
    ))
    if (selectedBrief?.id === briefId) {
      setSelectedBrief(prev => prev ? { ...prev, pipeline_status: 'in_production', internal_status: 'in_production' } : null)
    }
  }

  async function handleDeleteBrief(briefId: string) {
    const supabase = createClient()
    await supabase.from('brief_comments').delete().eq('brief_id', briefId)
    await supabase.from('notifications').delete().eq('link', `/trello?briefId=${briefId}`)
    await supabase.storage.from('brief-assets').remove([`brief-covers/${briefId}.jpg`])
    const { error } = await supabase.from('briefs').delete().eq('id', briefId)
    if (error) { alert(`Could not delete brief: ${error.message}`); return }
    setBriefs(prev => prev.filter(b => b.id !== briefId))
    setSelectedBrief(null)
  }

  async function handleCoverUpload(briefId: string, file: File | null) {
    if (!file) return
    const MAX_MB = 10
    if (file.size > MAX_MB * 1024 * 1024) { alert(`Image is too large. Max ${MAX_MB}MB.`); return }
    const ACCEPTED = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
    if (!ACCEPTED.includes(file.type)) { alert(`Unsupported file type "${file.type}".`); return }

    let compressed: Blob
    try {
      compressed = await new Promise<Blob>((resolve, reject) => {
        const img = document.createElement('img')
        const url = URL.createObjectURL(file)
        img.onload = () => {
          URL.revokeObjectURL(url)
          const MAX = 800
          const scale = img.width > MAX ? MAX / img.width : 1
          const canvas = document.createElement('canvas')
          canvas.width  = Math.round(img.width  * scale)
          canvas.height = Math.round(img.height * scale)
          canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
          canvas.toBlob(b => b ? resolve(b) : reject(new Error('Compression failed')), 'image/jpeg', 0.82)
        }
        img.onerror = (e) => reject(new Error(`Image load error: ${e}`))
        img.src = url
      })
    } catch (err) { alert(`Image compression failed: ${err}`); return }

    const supabase = createClient()
    const path = `brief-covers/${briefId}.jpg`
    const { error: uploadError } = await supabase.storage
      .from('brief-assets')
      .upload(path, compressed, { upsert: true, contentType: 'image/jpeg' })
    if (uploadError) { alert(`Cover upload failed: ${uploadError.message}`); return }

    const { data: { publicUrl } } = supabase.storage.from('brief-assets').getPublicUrl(path)
    const bustedUrl = `${publicUrl}?t=${Date.now()}`
    await supabase.from('briefs').update({ cover_url: bustedUrl }).eq('id', briefId)
    setBriefs(prev => prev.map(b => b.id === briefId ? { ...b, cover_url: bustedUrl } : b))
    setSelectedBrief(prev => prev?.id === briefId ? { ...prev, cover_url: bustedUrl } : prev)
  }

  async function handleCoverDelete(briefId: string) {
    const supabase = createClient()
    await supabase.storage.from('brief-assets').remove([`brief-covers/${briefId}.jpg`])
    await supabase.from('briefs').update({ cover_url: null }).eq('id', briefId)
    setBriefs(prev => prev.map(b => b.id === briefId ? { ...b, cover_url: null } : b))
    setSelectedBrief(prev => prev?.id === briefId ? { ...prev, cover_url: null } : prev)
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
    setSelectedBrief(prev => prev?.id === briefId ? {
      ...prev,
      assigned_to: staffId,
      assigned_designer: designer ? { id: designer.id, name: designer.name, avatar_url: designer.avatar_url } : null,
    } : prev)
  }

  const clientColor = client?.color ?? '#4950F8'
  const portalUrl = client ? `https://${client.slug}.${ROOT_DOMAIN}` : '#'
  const allApproved = byColumn.approved
  const approvedCards = showAllApproved ? allApproved : allApproved.slice(0, 10)

  return (
    <div className="pipeline-bg min-h-[calc(100vh-3.5rem)] text-gray-900 dark:text-white">
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="p-6 space-y-5">
          {/* Header (Hub-specific) */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push('/')}
                aria-label="Back to All Clients"
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10 hover:text-gray-700 dark:hover:text-white transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              {client && (
                <div
                  className="h-9 w-9 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0 overflow-hidden"
                  style={{ backgroundColor: client.color }}
                >
                  {client.logo_url
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={client.logo_url} alt="" className="h-full w-full object-contain p-1 brightness-0 invert" />
                    : client?.name.slice(0, 2).toUpperCase()
                  }
                </div>
              )}
              <div className="min-w-0">
                <h1 className="text-xl font-bold text-gray-900 dark:text-white truncate">{client?.name ?? 'Creative Requests'}</h1>
                <p className="text-sm text-gray-400 mt-0.5">Track and review all creative work</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {client && (
                <a
                  href={portalUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-gray-600 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-white/10 dark:hover:text-white transition-colors"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Client portal
                </a>
              )}
              <button
                onClick={() => setShowBriefModal(true)}
                className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
                style={{ backgroundColor: clientColor }}
              >
                <Plus className="h-4 w-4" />
                Create Brief
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex gap-3 overflow-x-auto pb-2">
              {[1,2,3].map(n => <div key={n} className="flex-shrink-0 w-[272px] h-96 rounded-2xl bg-gray-200 dark:bg-white/5 animate-pulse" />)}
            </div>
          ) : (
            <div className="flex gap-3 items-start overflow-x-auto pb-2">
              {COLUMNS.map(col => {
                const colBriefs = byColumn[col.key]

                // Approved column is read-only (no drop target) and uses the
                // compact ApprovedBriefCard. See Task 6 for re-run behaviour.
                if (col.key === 'approved') {
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
                            {allApproved.length}
                          </span>
                        </div>
                        <div className="h-7 w-7" />
                      </div>
                      <p className="px-4 pt-3 text-[11px] text-gray-400 dark:text-zinc-500">
                        Approved briefs auto-delete after 90 days
                      </p>
                      <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-[200px]">
                        {approvedCards.map(brief => (
                          <button
                            key={brief.id}
                            type="button"
                            onClick={() => setSelectedBrief(brief)}
                            className="block w-full text-left cursor-pointer"
                          >
                            <ApprovedBriefCard brief={brief} clientColor={clientColor} />
                          </button>
                        ))}
                        {allApproved.length === 0 && (
                          <div className="rounded-2xl border border-dashed border-gray-200 dark:border-white/[0.08] bg-gray-50/50 dark:bg-white/[0.02] py-12 text-center">
                            <p className="text-xs text-gray-400 dark:text-zinc-500">{col.empty}</p>
                          </div>
                        )}
                        {allApproved.length > 10 && (
                          <button
                            onClick={() => setShowAllApproved(v => !v)}
                            className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 py-2.5 text-xs font-medium text-gray-500 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-white/10 dark:hover:text-white transition-colors"
                          >
                            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showAllApproved ? 'rotate-180' : ''}`} />
                            {showAllApproved ? 'Show less' : `See all ${allApproved.length} approved`}
                          </button>
                        )}
                      </div>
                    </div>
                  )
                }

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
                      {col.key === 'in_production' ? (
                        <button
                          onClick={() => setShowBriefModal(true)}
                          aria-label="New brief"
                          className="h-7 w-7 rounded-lg flex items-center justify-center text-gray-400 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-white/10 hover:text-gray-700 dark:hover:text-white transition-colors"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      ) : (
                        <div className="h-7 w-7" />
                      )}
                    </div>
                    <Droppable droppableId={col.key}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          className={`flex-1 overflow-y-auto p-3 space-y-3 min-h-[200px] transition-colors ${snapshot.isDraggingOver ? 'bg-gray-100/60 dark:bg-white/[0.04] ring-1 ring-inset ring-gray-200 dark:ring-white/[0.08]' : ''}`}
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
                                    clientColor={clientColor}
                                    reviewMode={col.key === 'ready_for_review'}
                                    dragHandleProps={dragProvided.dragHandleProps}
                                    isDragging={dragSnapshot.isDragging}
                                    onOpen={() => !dragSnapshot.isDragging && setSelectedBrief(brief)}
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
          )}

          {/* Brief detail panel */}
          {selectedBrief && client && (
            <BriefPanel
              brief={selectedBrief}
              clientColor={clientColor}
              showInternalNotesTab
              hubStaff={hubStaff}
              onAssignDesigner={handleAssignDesigner}
              onClose={() => setSelectedBrief(null)}
              onApprove={() => handleApprove(selectedBrief.id)}
              onRequestRevisions={() => handleRequestRevisions(selectedBrief.id)}
              onCoverUpload={(file) => handleCoverUpload(selectedBrief.id, file)}
              onCoverDelete={() => handleCoverDelete(selectedBrief.id)}
              onDelete={() => handleDeleteBrief(selectedBrief.id)}
              onReload={() => load(true)}
            />
          )}

          {/* Create brief */}
          {showBriefModal && client && (
            <CreateBriefModal
              clientId={client.id}
              clientColor={clientColor}
              onClose={() => setShowBriefModal(false)}
              onCreated={() => { setShowBriefModal(false); load(true) }}
            />
          )}
        </div>
      </DragDropContext>

      {loading === false && !client && (
        <div className="flex items-center justify-center py-20">
          <div className="flex items-center gap-2 text-gray-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Client not found</span>
          </div>
        </div>
      )}
    </div>
  )
}
