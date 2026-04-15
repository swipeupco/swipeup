'use client'

import { useEffect, useState, use } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ExternalLink } from 'lucide-react'
import { BriefDrawer } from '@/components/pipeline/BriefDrawer'

interface Client {
  id: string
  name: string
  slug: string
  color: string
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
}

import { CLIENT_STAGES as STAGES, CLIENT_STAGE_LABELS } from '@/lib/pipeline/stages'

const CLIENT_PORTAL_URL = process.env.NEXT_PUBLIC_CLIENT_URL ?? 'https://offtrackrvhub.vercel.app'

export default function ClientPipeline({ params }: { params: Promise<{ clientSlug: string }> }) {
  const { clientSlug } = use(params)
  const [client, setClient]       = useState<Client | null>(null)
  const [briefs, setBriefs]       = useState<Brief[]>([])
  const [loading, setLoading]     = useState(true)
  const [selectedBrief, setSelectedBrief] = useState<Brief | null>(null)
  const router = useRouter()

  async function load() {
    const supabase = createClient()
    const { data: clientData } = await supabase
      .from('clients')
      .select('*')
      .eq('slug', clientSlug)
      .single()

    if (!clientData) { setLoading(false); return }
    setClient(clientData)

    const { data: briefData } = await supabase
      .from('briefs')
      .select('*')
      .eq('client_id', clientData.id)
      .order('pos', { ascending: true })

    setBriefs((briefData as unknown as Brief[]) ?? [])
    setLoading(false)
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

  async function moveToStage(briefId: string, newStage: string) {
    const supabase = createClient()
    await supabase.from('briefs').update({ pipeline_status: newStage }).eq('id', briefId)
    setBriefs(prev => prev.map(b => b.id === briefId ? { ...b, pipeline_status: newStage } : b))
    if (selectedBrief?.id === briefId) {
      setSelectedBrief(prev => prev ? { ...prev, pipeline_status: newStage } : null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-6 w-6 border-2 border-[#14C29F] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!client) {
    return <div className="p-8 text-zinc-500">Client not found.</div>
  }

  const clientUrl = CLIENT_PORTAL_URL

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-zinc-200 flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/')}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div
            className="h-8 w-8 rounded-lg flex items-center justify-center text-white font-bold text-xs"
            style={{ backgroundColor: client.color }}
          >
            {client.name.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <h1 className="font-semibold text-zinc-900">{client.name}</h1>
            <p className="text-xs text-zinc-400">{briefs.length} briefs</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {clientUrl && (
            <a
              href={clientUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium border border-zinc-200 text-zinc-600 hover:bg-zinc-50 transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Open client dashboard
            </a>
          )}
        </div>
      </div>

      {/* Kanban board */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <div className="flex h-full gap-0 min-w-max">
          {STAGES.map((stage, i) => {
            const stageBriefs = briefs.filter(b => b.pipeline_status === stage.key)
            const isLast = i === STAGES.length - 1

            return (
              <div
                key={stage.key}
                className={`flex flex-col w-72 h-full ${stage.color} ${!isLast ? 'border-r border-zinc-200' : ''}`}
              >
                {/* Stage header */}
                <div className={`flex items-center justify-between px-4 py-3 ${stage.header}`}>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-semibold uppercase tracking-wide ${stage.text}`}>{stage.label}</span>
                    <span className={`text-xs font-bold rounded-full px-1.5 py-0.5 bg-white/60 ${stage.text}`}>
                      {stageBriefs.length}
                    </span>
                  </div>
                </div>

                {/* Cards */}
                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                  {stageBriefs.map(brief => (
                    <BriefCard
                      key={brief.id}
                      brief={brief}
                      stageKey={stage.key}
                      clientColor={client.color}
                      onClick={() => setSelectedBrief(brief)}
                      onMove={moveToStage}
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

      {/* Brief detail drawer */}
      {selectedBrief && (
        <BriefDrawer
          brief={selectedBrief}
          clientColor={client.color}
          onClose={() => setSelectedBrief(null)}
          onMove={moveToStage}
          onRefresh={load}
        />
      )}
    </div>
  )
}

function BriefCard({ brief, stageKey, clientColor, onClick, onMove }: {
  brief: Brief
  stageKey: string
  clientColor: string
  onClick: () => void
  onMove: (id: string, stage: string) => void
}) {
  const stageKeys = STAGES.map(s => s.key)
  const currentIndex = stageKeys.indexOf(stageKey)
  const canAdvance = currentIndex < stageKeys.length - 1
  const nextStage = canAdvance ? stageKeys[currentIndex + 1] : null
  const nextLabel = nextStage ? STAGES[currentIndex + 1].label : null

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-xl border border-zinc-200 p-3 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
    >
      <p className="text-sm font-semibold text-zinc-800 leading-snug mb-1">{brief.name}</p>

      {brief.campaign && (
        <p className="text-xs text-zinc-400 mb-2">{brief.campaign}</p>
      )}

      <div className="flex items-center justify-between gap-2 mt-2 flex-wrap">
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
      </div>

      {/* Advance button */}
      {nextStage && (
        <button
          onClick={e => { e.stopPropagation(); onMove(brief.id, nextStage) }}
          className="mt-2.5 w-full text-[10px] font-semibold rounded-lg py-1.5 text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: clientColor }}
        >
          Move to {nextLabel} →
        </button>
      )}
    </div>
  )
}
