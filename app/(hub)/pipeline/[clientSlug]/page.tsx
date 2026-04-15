'use client'

import { useEffect, useState, use } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ExternalLink, Plus, X, Loader2 } from 'lucide-react'
import { BriefDrawer } from '@/components/pipeline/BriefDrawer'
import { CLIENT_STAGES as STAGES } from '@/lib/pipeline/stages'
import { updateBriefStatus } from '@/lib/pipeline/updateBriefStatus'

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

const CONTENT_TYPES = ['Video', 'Graphic', 'EDM', 'Signage', 'Voiceover', 'Script', 'Other']

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'portal.swipeupco.com'

export default function ClientPipeline({ params }: { params: Promise<{ clientSlug: string }> }) {
  const { clientSlug } = use(params)
  const [client, setClient]           = useState<Client | null>(null)
  const [briefs, setBriefs]           = useState<Brief[]>([])
  const [loading, setLoading]         = useState(true)
  const [selectedBrief, setSelectedBrief] = useState<Brief | null>(null)
  const [showNewBrief, setShowNewBrief]   = useState(false)
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

  async function moveToStage(briefId: string, newPipelineStage: string) {
    // Optimistic update
    setBriefs(prev => prev.map(b =>
      b.id === briefId ? { ...b, pipeline_status: newPipelineStage } : b
    ))
    if (selectedBrief?.id === briefId) {
      setSelectedBrief(prev => prev ? { ...prev, pipeline_status: newPipelineStage } : null)
    }

    // Write both fields atomically
    const updates = await updateBriefStatus(briefId, { pipeline_status: newPipelineStage })

    // Sync internal_status back to local state
    setBriefs(prev => prev.map(b => b.id === briefId ? { ...b, ...updates } : b))
    if (selectedBrief?.id === briefId) {
      setSelectedBrief(prev => prev ? { ...prev, ...updates } : null)
    }
  }

  async function moveInternalStage(briefId: string, newInternalStage: string) {
    // Internal status can change independently of pipeline_status
    setBriefs(prev => prev.map(b =>
      b.id === briefId ? { ...b, internal_status: newInternalStage } : b
    ))
    if (selectedBrief?.id === briefId) {
      setSelectedBrief(prev => prev ? { ...prev, internal_status: newInternalStage } : null)
    }
    const supabase = createClient()
    await supabase.from('briefs').update({ internal_status: newInternalStage }).eq('id', briefId)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-6 w-6 border-2 border-[#14C29F] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!client) return <div className="p-8 text-zinc-500">Client not found.</div>

  const portalUrl = `https://${client.slug}.${ROOT_DOMAIN}`

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
          <a
            href={portalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium border border-zinc-200 text-zinc-600 hover:bg-zinc-50 transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Client portal
          </a>
          <button
            onClick={() => setShowNewBrief(true)}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: client.color }}
          >
            <Plus className="h-3.5 w-3.5" />
            New Brief
          </button>
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
                <div className={`flex items-center justify-between px-4 py-3 ${stage.header}`}>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-semibold uppercase tracking-wide ${stage.text}`}>{stage.label}</span>
                    <span className={`text-xs font-bold rounded-full px-1.5 py-0.5 bg-white/60 ${stage.text}`}>
                      {stageBriefs.length}
                    </span>
                  </div>
                </div>

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
          clientName={client.name}
          internalMode
          onClose={() => setSelectedBrief(null)}
          onMove={moveToStage}
          onInternalMove={moveInternalStage}
          onRefresh={load}
          onBriefUpdate={(updates) => {
            setBriefs(prev => prev.map(b => b.id === selectedBrief.id ? { ...b, ...updates } : b))
            setSelectedBrief(prev => prev ? { ...prev, ...updates } : null)
          }}
        />
      )}

      {/* New Brief modal */}
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

// ─── Brief Card ───────────────────────────────────────────────────────────────

function BriefCard({ brief, stageKey, clientColor, onClick, onMove }: {
  brief: Brief
  stageKey: string
  clientColor: string
  onClick: () => void
  onMove: (id: string, stage: string) => void
}) {
  const stageKeys = STAGES.map(s => s.key)
  const currentIndex = stageKeys.indexOf(stageKey)
  const nextStage = currentIndex < stageKeys.length - 1 ? stageKeys[currentIndex + 1] : null
  const nextLabel = nextStage ? STAGES[currentIndex + 1].label : null
  const isRevisions = brief.internal_status === 'revisions_required'
  const hasDraft = !!brief.draft_url

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-xl border border-zinc-200 p-3 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
    >
      <p className="text-sm font-semibold text-zinc-800 leading-snug mb-1">{brief.name}</p>

      {brief.campaign && (
        <p className="text-xs text-zinc-400 mb-2 truncate">{brief.campaign}</p>
      )}

      <div className="flex items-center gap-1.5 flex-wrap mt-2">
        {brief.content_type && (
          <span className="text-[10px] font-medium rounded-full px-2 py-0.5 bg-zinc-100 text-zinc-600">
            {brief.content_type}
          </span>
        )}
        {hasDraft && (
          <span className="text-[10px] font-medium rounded-full px-2 py-0.5 bg-teal-50 text-teal-700">
            Draft ready
          </span>
        )}
        {isRevisions && (
          <span className="text-[10px] font-medium rounded-full px-2 py-0.5 bg-red-50 text-red-600">
            Revisions
          </span>
        )}
        {brief.due_date && (
          <span className="text-[10px] font-medium rounded-full px-2 py-0.5 bg-zinc-100 text-zinc-500">
            Due {new Date(brief.due_date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
          </span>
        )}
      </div>

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
    await supabase.from('briefs').insert({
      name:            name.trim(),
      description:     description.trim() || null,
      campaign:        campaign.trim() || null,
      content_type:    contentType || null,
      due_date:        dueDate || null,
      client_id:       clientId,
      pipeline_status: 'backlog',
      internal_status: 'in_production',
    })
    setSaving(false)
    onCreated()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="font-bold text-zinc-900">New Brief</h2>
            <p className="text-xs text-zinc-400 mt-0.5">{clientName}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wide block mb-1.5">Brief Name *</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              autoFocus
              placeholder="e.g. Summer Sale Banner"
              className="w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#14C29F]/30 focus:border-[#14C29F]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wide block mb-1.5">Campaign</label>
              <input
                type="text"
                value={campaign}
                onChange={e => setCampaign(e.target.value)}
                placeholder="e.g. Summer 2025"
                className="w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#14C29F]/30"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wide block mb-1.5">Due Date</label>
              <input
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                className="w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#14C29F]/30"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wide block mb-1.5">Content Type</label>
            <div className="flex gap-2 flex-wrap">
              {CONTENT_TYPES.map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setContentType(contentType === t ? '' : t)}
                  className={`rounded-full px-3 py-1 text-xs font-medium border transition-all ${
                    contentType === t
                      ? 'text-white border-transparent bg-zinc-900'
                      : 'bg-white border-zinc-200 text-zinc-600 hover:border-zinc-300'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wide block mb-1.5">Brief Details</label>
            <textarea
              value={description}
              onChange={e => setDesc(e.target.value)}
              rows={3}
              placeholder="Describe what's needed, references, requirements…"
              className="w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#14C29F]/30 resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={saving || !name.trim()}
            className="w-full rounded-xl py-2.5 text-sm font-semibold text-white disabled:opacity-50 transition-opacity hover:opacity-90"
            style={{ backgroundColor: clientColor }}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : 'Create Brief'}
          </button>
        </form>
      </div>
    </div>
  )
}
