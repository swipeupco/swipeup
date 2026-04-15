'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { BriefDrawer } from '@/components/pipeline/BriefDrawer'
import { AlertTriangle, MessageSquare } from 'lucide-react'

interface ClientInfo {
  name: string
  color: string
  slug: string
}

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
  clients: ClientInfo | null
}

const INTERNAL_STAGES = [
  { key: 'in_production',      label: 'In Production',      shortLabel: 'In Prod',    color: 'bg-amber-50',  header: 'bg-amber-200',  text: 'text-amber-800' },
  { key: 'revisions_required', label: 'Revisions Required', shortLabel: 'Revisions',  color: 'bg-red-50',    header: 'bg-red-200',    text: 'text-red-800' },
  { key: 'ready_for_review',   label: 'Ready for Review',   shortLabel: 'Ready',      color: 'bg-blue-50',   header: 'bg-blue-200',   text: 'text-blue-800' },
  { key: 'approved_by_client', label: 'Approved by Client', shortLabel: 'Approved',   color: 'bg-green-50',  header: 'bg-green-200',  text: 'text-green-800' },
]

export default function InternalPipeline() {
  const [briefs, setBriefs]           = useState<Brief[]>([])
  const [feedbackCounts, setFeedback] = useState<Record<string, number>>({})
  const [loading, setLoading]         = useState(true)
  const [selected, setSelected]       = useState<Brief | null>(null)

  async function load() {
    const supabase = createClient()

    const { data: briefData } = await supabase
      .from('briefs')
      .select('*, clients(name, color, slug)')
      .order('created_at', { ascending: false })

    // Count client feedback (non-internal) comments per brief
    const { data: commentData } = await supabase
      .from('brief_comments')
      .select('brief_id')
      .eq('is_internal', false)

    const counts: Record<string, number> = {}
    commentData?.forEach(c => { counts[c.brief_id] = (counts[c.brief_id] ?? 0) + 1 })

    setBriefs((briefData as unknown as Brief[]) ?? [])
    setFeedback(counts)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function moveInternal(briefId: string, newStatus: string) {
    const supabase = createClient()
    await supabase.from('briefs').update({ internal_status: newStatus }).eq('id', briefId)
    setBriefs(prev => prev.map(b => b.id === briefId ? { ...b, internal_status: newStatus } : b))
    setSelected(prev => prev?.id === briefId ? { ...prev, internal_status: newStatus } : prev)
  }

  async function moveClient(briefId: string, newStage: string) {
    const supabase = createClient()
    await supabase.from('briefs').update({ pipeline_status: newStage }).eq('id', briefId)
    setBriefs(prev => prev.map(b => b.id === briefId ? { ...b, pipeline_status: newStage } : b))
    setSelected(prev => prev?.id === briefId ? { ...prev, pipeline_status: newStage } : prev)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-6 w-6 border-2 border-[#14C29F] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const revisionsCount = briefs.filter(b => (b.internal_status ?? 'in_production') === 'revisions_required').length

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-zinc-200 flex-shrink-0">
        <div>
          <h1 className="font-semibold text-zinc-900">Production Pipeline</h1>
          <p className="text-xs text-zinc-400">{briefs.length} briefs across all clients</p>
        </div>
        {revisionsCount > 0 && (
          <div className="flex items-center gap-1.5 rounded-lg bg-red-50 border border-red-100 px-3 py-1.5">
            <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
            <span className="text-xs font-semibold text-red-700">
              {revisionsCount} brief{revisionsCount !== 1 ? 's' : ''} need revisions
            </span>
          </div>
        )}
      </div>

      {/* Kanban board */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <div className="flex h-full gap-0 min-w-max">
          {INTERNAL_STAGES.map((stage, i) => {
            const stageBriefs = briefs.filter(b => (b.internal_status ?? 'in_production') === stage.key)
            const isLast = i === INTERNAL_STAGES.length - 1

            return (
              <div
                key={stage.key}
                className={`flex flex-col w-72 h-full ${stage.color} ${!isLast ? 'border-r border-zinc-200' : ''}`}
              >
                <div className={`flex items-center gap-2 px-4 py-3 ${stage.header}`}>
                  <span className={`text-xs font-semibold uppercase tracking-wide ${stage.text}`}>{stage.label}</span>
                  <span className={`text-xs font-bold rounded-full px-1.5 py-0.5 bg-white/60 ${stage.text}`}>
                    {stageBriefs.length}
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                  {stageBriefs.map(brief => (
                    <InternalCard
                      key={brief.id}
                      brief={brief}
                      stageKey={stage.key}
                      feedbackCount={feedbackCounts[brief.id] ?? 0}
                      onClick={() => setSelected(brief)}
                      onMove={moveInternal}
                    />
                  ))}
                  {stageBriefs.length === 0 && (
                    <div className="flex items-center justify-center h-16 rounded-xl border-2 border-dashed border-zinc-200">
                      <p className="text-xs text-zinc-400">Empty</p>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {selected && (
        <BriefDrawer
          brief={selected}
          clientColor={selected.clients?.color ?? '#14C29F'}
          clientName={selected.clients?.name}
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

function InternalCard({ brief, stageKey, feedbackCount, onClick, onMove }: {
  brief: Brief
  stageKey: string
  feedbackCount: number
  onClick: () => void
  onMove: (id: string, status: string) => void
}) {
  const stageKeys = INTERNAL_STAGES.map(s => s.key)
  const currentIndex = stageKeys.indexOf(stageKey)
  const nextStage = currentIndex < stageKeys.length - 1 ? stageKeys[currentIndex + 1] : null
  const nextLabel = nextStage ? INTERNAL_STAGES[currentIndex + 1].label : null
  const client = brief.clients
  const hasRevisionFeedback = stageKey === 'revisions_required' && feedbackCount > 0

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-xl border border-zinc-200 p-3 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
    >
      {/* Client + revision badge row */}
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        {client && (
          <span
            className="text-[10px] font-bold text-white rounded-full px-2 py-0.5"
            style={{ backgroundColor: client.color }}
          >
            {client.name}
          </span>
        )}
        {hasRevisionFeedback && (
          <span className="flex items-center gap-1 text-[10px] font-semibold text-red-600">
            <AlertTriangle className="h-2.5 w-2.5" />
            Revisions needed
          </span>
        )}
        {brief.pipeline_status === 'client_review' && stageKey !== 'approved_by_client' && (
          <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 rounded-full px-2 py-0.5">
            With client
          </span>
        )}
      </div>

      <p className="text-sm font-semibold text-zinc-800 leading-snug">{brief.name}</p>
      {brief.campaign && <p className="text-xs text-zinc-400 mt-0.5">{brief.campaign}</p>}

      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
        {brief.content_type && (
          <span className="text-[10px] font-medium rounded-full px-2 py-0.5 bg-zinc-100 text-zinc-600">
            {brief.content_type}
          </span>
        )}
        {brief.draft_url && (
          <span className="text-[10px] font-medium rounded-full px-2 py-0.5 bg-teal-50 text-teal-700">
            Draft ready
          </span>
        )}
        {feedbackCount > 0 && (
          <span className="flex items-center gap-1 text-[10px] font-medium rounded-full px-2 py-0.5 bg-blue-50 text-blue-600">
            <MessageSquare className="h-2.5 w-2.5" />
            {feedbackCount}
          </span>
        )}
      </div>

      {nextStage && (
        <button
          onClick={e => { e.stopPropagation(); onMove(brief.id, nextStage) }}
          className="mt-2.5 w-full text-[10px] font-semibold rounded-lg py-1.5 bg-zinc-800 text-white hover:opacity-80 transition-opacity"
        >
          Move to {nextLabel} →
        </button>
      )}
    </div>
  )
}
