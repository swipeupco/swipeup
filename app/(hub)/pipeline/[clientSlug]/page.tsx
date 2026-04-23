'use client'

/**
 * Per-client board — mirrors the Portal's Creative Requests page exactly.
 *
 * 3 columns: Backlog, In Production, Approved (the same as the Portal's
 * /trello page). "Ready for Review" is an internal-only stage and lives
 * only on the master Production Pipeline view.
 *
 * Hub-only overlays:
 *   - Sticky header with a "Back" button and the "Client portal" link.
 *   - BriefCard shows a tiny assigned-designer chip on the bottom row.
 *   - BriefPanel exposes an "Internal" comments tab (is_internal=true) and
 *     an "Assigned designer" picker that writes to briefs.assigned_to.
 *   - "With client" blue pill on a card when pipeline_status='client_review'.
 *
 * All styling, spacing, and card/drawer chrome is ported from the Portal
 * (see components/pipeline/PortalBoard.tsx).
 */

export const dynamic = 'force-dynamic'

import { useEffect, useState, use } from 'react'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'
import { Plus, ChevronDown, ArrowLeft, ExternalLink, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import {
  Brief, BriefCard, ApprovedBriefCard, BriefPanel, CreateBriefModal,
} from '@/components/pipeline/PortalBoard'

interface Client { id: string; name: string; slug: string; color: string; logo_url: string | null }
interface HubStaffLite { id: string; name: string | null; avatar_url: string | null; email: string | null }

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'portal.swipeupco.com'

export default function ClientPipeline({ params }: { params: Promise<{ clientSlug: string }> }) {
  const { clientSlug } = use(params)
  const router = useRouter()

  const [client, setClient]           = useState<Client | null>(null)
  const [briefs, setBriefs]           = useState<Brief[]>([])
  const [backlogOrder, setBacklogOrder] = useState<Brief[]>([])
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
      supabase
        .from('briefs')
        .select('*')
        .eq('client_id', clientData.id)
        .order('sort_order', { ascending: true }),
      supabase
        .from('profiles')
        .select('id, name, avatar_url, email')
        .or('hub_role.eq.admin,hub_role.eq.designer,is_staff.eq.true,is_admin.eq.true'),
    ])

    const all = (briefData ?? []) as Brief[]
    setHubStaff((staffData as HubStaffLite[]) ?? [])

    // Enforce: only 1 brief in production at a time (same rule the Portal uses)
    const inProd = all.filter(b => ['in_production','client_review','qa_review'].includes(b.pipeline_status))
    if (inProd.length > 1) {
      const toBacklog = inProd.slice(1)
      await Promise.all(toBacklog.map(b =>
        supabase.from('briefs').update({ pipeline_status: 'backlog', internal_status: 'backlog' }).eq('id', b.id)
      ))
      toBacklog.forEach(b => { b.pipeline_status = 'backlog'; b.internal_status = 'backlog' })
    }

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

  useEffect(() => {
    setBacklogOrder(
      briefs
        .filter(b => b.pipeline_status === 'backlog')
        .sort((a, b) => (a.sort_order ?? 9999) - (b.sort_order ?? 9999))
    )
  }, [briefs])

  // ── DnD identical to Portal's trello page ─────────────────────────────────
  async function handleDragEnd(result: DropResult) {
    const { source, destination, draggableId } = result
    if (!destination) return
    if (source.droppableId === destination.droppableId && source.index === destination.index) return

    const supabase = createClient()

    if (source.droppableId === 'backlog' && destination.droppableId === 'backlog') {
      const items = Array.from(backlogOrder)
      const [moved] = items.splice(source.index, 1)
      items.splice(destination.index, 0, moved)
      setBacklogOrder(items)
      await Promise.all(items.map((b, i) => supabase.from('briefs').update({ sort_order: i }).eq('id', b.id)))
      return
    }

    if (source.droppableId === 'backlog' && destination.droppableId === 'in-production') {
      const currentInProd = briefs.filter(b => ['in_production','client_review','qa_review'].includes(b.pipeline_status))
      if (currentInProd.length > 0) {
        await Promise.all(currentInProd.map(b =>
          supabase.from('briefs').update({ pipeline_status: 'backlog', internal_status: 'backlog' }).eq('id', b.id)
        ))
      }
      await supabase.from('briefs')
        .update({ pipeline_status: 'in_production', internal_status: 'in_production' })
        .eq('id', draggableId)
      setBriefs(prev => prev.map(b => {
        if (currentInProd.find(p => p.id === b.id)) return { ...b, pipeline_status: 'backlog', internal_status: 'backlog' }
        if (b.id === draggableId) return { ...b, pipeline_status: 'in_production', internal_status: 'in_production' }
        return b
      }))
      return
    }

    if (source.droppableId === 'in-production' && destination.droppableId === 'backlog') {
      await supabase.from('briefs')
        .update({ pipeline_status: 'backlog', internal_status: 'backlog' })
        .eq('id', draggableId)
      setBriefs(prev => prev.map(b =>
        b.id === draggableId ? { ...b, pipeline_status: 'backlog', internal_status: 'backlog' } : b
      ))
      return
    }
  }

  async function handleApprove(briefId: string) {
    const supabase = createClient()
    await supabase
      .from('briefs')
      .update({ pipeline_status: 'approved', internal_status: 'approved_by_client' })
      .eq('id', briefId)

    let newBriefs = briefs.map(b =>
      b.id === briefId ? { ...b, pipeline_status: 'approved', internal_status: 'approved_by_client' } : b
    )

    // Auto-promote top backlog brief if production slot is now empty
    const wasInProduction = briefs.filter(b =>
      ['in_production', 'client_review', 'qa_review'].includes(b.pipeline_status)
    )
    const nextBacklog = briefs
      .filter(b => b.pipeline_status === 'backlog')
      .sort((a, b) => (a.sort_order ?? 9999) - (b.sort_order ?? 9999))[0]

    if (wasInProduction.length === 1 && nextBacklog) {
      await supabase
        .from('briefs')
        .update({ pipeline_status: 'in_production', internal_status: 'in_production' })
        .eq('id', nextBacklog.id)
      newBriefs = newBriefs.map(b =>
        b.id === nextBacklog.id ? { ...b, pipeline_status: 'in_production', internal_status: 'in_production' } : b
      )
    }

    setBriefs(newBriefs)
    if (selectedBrief?.id === briefId) {
      setSelectedBrief(prev => prev ? { ...prev, pipeline_status: 'approved', internal_status: 'approved_by_client' } : null)
    }
  }

  async function handleRequestRevisions(briefId: string) {
    const supabase = createClient()
    await supabase
      .from('briefs')
      .update({ pipeline_status: 'client_review', internal_status: 'revisions_required' })
      .eq('id', briefId)
    setBriefs(prev => prev.map(b =>
      b.id === briefId ? { ...b, pipeline_status: 'client_review', internal_status: 'revisions_required' } : b
    ))
    if (selectedBrief?.id === briefId) {
      setSelectedBrief(prev => prev ? { ...prev, pipeline_status: 'client_review', internal_status: 'revisions_required' } : null)
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

  const inProduction  = briefs.filter(b => ['in_production', 'client_review', 'qa_review'].includes(b.pipeline_status))
  const allApproved   = briefs.filter(b => b.pipeline_status === 'approved')
  const approvedCards = showAllApproved ? allApproved : allApproved.slice(0, 10)

  const clientColor = client?.color ?? '#4950F8'
  const portalUrl = client ? `https://${client.slug}.${ROOT_DOMAIN}` : '#'

  return (
    // pipeline-bg: radial brand-violet glow from bottom-left on a near-black
    // base in dark mode; subtle same-recipe variant in light. See app/globals.css.
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
            // Trello-style: fixed 272px columns, board scrolls horizontally
            // when the 3 don't fit; each column scrolls vertically on overflow.
            <div className="flex gap-3 items-start overflow-x-auto pb-2">

              {/* Backlog */}
              <div className="flex-shrink-0 w-[272px] flex flex-col max-h-[calc(100vh-14rem)] bg-white dark:bg-[#0F1420] rounded-2xl border border-gray-100 dark:border-white/[0.08] shadow-sm dark:shadow-none overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50 dark:border-white/[0.06] flex-shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-amber-400 flex-shrink-0" />
                    <h3 className="text-sm font-semibold text-gray-800 dark:text-slate-100">Backlog</h3>
                    <span className="text-[11px] font-medium text-gray-400 dark:text-zinc-400 bg-gray-100 dark:bg-white/10 rounded-full px-2 py-0.5">
                      {backlogOrder.length}
                    </span>
                  </div>
                  <button
                    onClick={() => setShowBriefModal(true)}
                    className="h-7 w-7 rounded-lg flex items-center justify-center text-gray-400 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-white/10 hover:text-gray-700 dark:hover:text-white transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>

                <Droppable droppableId="backlog">
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`flex-1 overflow-y-auto p-3 space-y-3 min-h-[200px] transition-colors ${snapshot.isDraggingOver ? 'bg-gray-100/60 dark:bg-white/[0.04] ring-1 ring-inset ring-gray-200 dark:ring-white/[0.08]' : ''}`}
                    >
                      {backlogOrder.map((brief, index) => (
                        <Draggable key={brief.id} draggableId={brief.id} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              style={provided.draggableProps.style}
                            >
                              <BriefCard
                                brief={brief}
                                clientColor={clientColor}
                                dragHandleProps={provided.dragHandleProps}
                                isDragging={snapshot.isDragging}
                                isUpNext={index === 0}
                                onOpen={() => !snapshot.isDragging && setSelectedBrief(brief)}
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
                      {backlogOrder.length === 0 && (
                        <div className="rounded-2xl border border-dashed border-gray-200 dark:border-white/[0.08] bg-gray-50/50 dark:bg-white/[0.02] py-12 text-center">
                          <p className="text-xs text-gray-400 dark:text-zinc-500">No briefs in backlog</p>
                        </div>
                      )}
                    </div>
                  )}
                </Droppable>
              </div>

              {/* In Production */}
              <div className="flex-shrink-0 w-[272px] flex flex-col max-h-[calc(100vh-14rem)] bg-white dark:bg-[#0F1420] rounded-2xl border border-gray-100 dark:border-white/[0.08] shadow-sm dark:shadow-none overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50 dark:border-white/[0.06] flex-shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-blue-400 flex-shrink-0" />
                    <h3 className="text-sm font-semibold text-gray-800 dark:text-slate-100">In Production</h3>
                    <span className="text-[11px] font-medium text-gray-400 dark:text-zinc-400 bg-gray-100 dark:bg-white/10 rounded-full px-2 py-0.5">
                      {inProduction.length}
                    </span>
                  </div>
                  <div className="h-7 w-7" />
                </div>
                <Droppable droppableId="in-production">
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`flex-1 overflow-y-auto p-3 space-y-3 min-h-[200px] transition-colors ${snapshot.isDraggingOver ? 'bg-gray-100/60 dark:bg-white/[0.04] ring-1 ring-inset ring-gray-200 dark:ring-white/[0.08]' : ''}`}
                    >
                      {inProduction.map((brief, index) => (
                        <Draggable key={brief.id} draggableId={brief.id} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              style={provided.draggableProps.style}
                            >
                              <BriefCard
                                brief={brief}
                                clientColor={clientColor}
                                reviewMode
                                dragHandleProps={provided.dragHandleProps}
                                isDragging={snapshot.isDragging}
                                onOpen={() => !snapshot.isDragging && setSelectedBrief(brief)}
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
                      {inProduction.length === 0 && (
                        <div className="rounded-2xl border border-dashed border-gray-200 dark:border-white/[0.08] bg-gray-50/50 dark:bg-white/[0.02] py-12 text-center">
                          <p className="text-xs text-gray-400 dark:text-zinc-500">Nothing in production yet</p>
                          <p className="text-[11px] text-gray-300 dark:text-zinc-600 mt-1">Drag a brief here or approve one</p>
                        </div>
                      )}
                    </div>
                  )}
                </Droppable>
              </div>

              {/* Approved */}
              <div className="flex-shrink-0 w-[272px] flex flex-col max-h-[calc(100vh-14rem)] bg-white dark:bg-[#0F1420] rounded-2xl border border-gray-100 dark:border-white/[0.08] shadow-sm dark:shadow-none overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50 dark:border-white/[0.06] flex-shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-400 flex-shrink-0" />
                    <h3 className="text-sm font-semibold text-gray-800 dark:text-slate-100">Approved</h3>
                    <span className="text-[11px] font-medium text-gray-400 dark:text-zinc-400 bg-gray-100 dark:bg-white/10 rounded-full px-2 py-0.5">
                      {allApproved.length}
                    </span>
                  </div>
                  <div className="h-7 w-7" />
                </div>
                <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-[200px]">
                  {approvedCards.map(brief => (
                    <ApprovedBriefCard key={brief.id} brief={brief} clientColor={clientColor} />
                  ))}
                  {allApproved.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-gray-200 dark:border-white/[0.08] bg-gray-50/50 dark:bg-white/[0.02] py-12 text-center">
                      <p className="text-xs text-gray-400 dark:text-zinc-500">No approved briefs yet</p>
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

      {/* Page-level loading overlay — kept outside DnD to avoid layout shift */}
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
