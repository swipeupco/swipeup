'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { ArrowRight, ExternalLink } from 'lucide-react'

interface Client {
  id: string
  name: string
  slug: string
  color: string
  logo_url: string | null
}

interface BriefCounts {
  backlog: number
  in_production: number
  qa_review: number
  client_review: number
  approved: number
}

const STAGES = [
  { key: 'backlog',       label: 'Backlog',         bg: 'bg-zinc-100',   text: 'text-zinc-600' },
  { key: 'in_production', label: 'In Production',   bg: 'bg-amber-100',  text: 'text-amber-700' },
  { key: 'qa_review',     label: 'QA Review',       bg: 'bg-purple-100', text: 'text-purple-700' },
  { key: 'client_review', label: 'Client Review',   bg: 'bg-blue-100',   text: 'text-blue-700' },
  { key: 'approved',      label: 'Approved',        bg: 'bg-green-100',  text: 'text-green-700' },
]

const CLIENT_URLS: Record<string, string> = {
  otrv: 'https://offtrackrvhub.vercel.app',
}

export default function ClientsOverview() {
  const [clients, setClients]     = useState<Client[]>([])
  const [counts, setCounts]       = useState<Record<string, BriefCounts>>({})
  const [loading, setLoading]     = useState(true)
  const router = useRouter()

  useEffect(() => {
    async function load() {
      const supabase = createClient()

      const { data: clientRows } = await supabase
        .from('clients')
        .select('*')
        .order('name')

      if (!clientRows) { setLoading(false); return }
      setClients(clientRows)

      // Fetch brief counts per client per stage
      const { data: briefs } = await supabase
        .from('briefs')
        .select('client_id, pipeline_status')

      const map: Record<string, BriefCounts> = {}
      clientRows.forEach(c => {
        map[c.id] = { backlog: 0, in_production: 0, qa_review: 0, client_review: 0, approved: 0 }
      })
      briefs?.forEach(b => {
        if (!b.client_id || !map[b.client_id]) return
        const stage = b.pipeline_status as keyof BriefCounts
        if (stage in map[b.client_id]) map[b.client_id][stage]++
      })
      setCounts(map)
      setLoading(false)
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-6 w-6 border-2 border-[#14C29F] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const totalActive = Object.values(counts).reduce((sum, c) => sum + c.in_production + c.qa_review + c.client_review, 0)

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-zinc-900">Clients</h1>
        <p className="text-sm text-zinc-500 mt-1">{clients.length} clients · {totalActive} active briefs across all pipelines</p>
      </div>

      {/* Client cards */}
      <div className="grid grid-cols-1 gap-4 max-w-4xl">
        {clients.map(client => {
          const c = counts[client.id] ?? { backlog: 0, in_production: 0, qa_review: 0, client_review: 0, approved: 0 }
          const total = Object.values(c).reduce((s, n) => s + n, 0)
          const clientUrl = CLIENT_URLS[client.slug]

          return (
            <div
              key={client.id}
              className="bg-white rounded-2xl border border-zinc-200 p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between gap-4">
                {/* Client info */}
                <div className="flex items-center gap-3">
                  <div
                    className="h-10 w-10 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                    style={{ backgroundColor: client.color }}
                  >
                    {client.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h2 className="font-semibold text-zinc-900">{client.name}</h2>
                    <p className="text-xs text-zinc-400">{total} briefs total</p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {clientUrl && (
                    <a
                      href={clientUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium border border-zinc-200 text-zinc-500 hover:bg-zinc-50 transition-colors"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Client dashboard
                    </a>
                  )}
                  <button
                    onClick={() => router.push(`/pipeline/${client.slug}`)}
                    className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-colors"
                    style={{ backgroundColor: client.color }}
                  >
                    View pipeline
                    <ArrowRight className="h-3 w-3" />
                  </button>
                </div>
              </div>

              {/* Stage pills */}
              <div className="flex gap-2 mt-4 flex-wrap">
                {STAGES.map(stage => {
                  const count = c[stage.key as keyof BriefCounts]
                  return (
                    <div
                      key={stage.key}
                      className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${stage.bg} ${stage.text}`}
                    >
                      <span>{stage.label}</span>
                      <span className="font-bold">{count}</span>
                    </div>
                  )
                })}
              </div>

              {/* Client review alert */}
              {c.client_review > 0 && (
                <div className="mt-3 flex items-center gap-2 rounded-lg bg-blue-50 border border-blue-100 px-3 py-2">
                  <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
                  <p className="text-xs text-blue-700 font-medium">
                    {c.client_review} brief{c.client_review !== 1 ? 's' : ''} waiting for client review
                  </p>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
