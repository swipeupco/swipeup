'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle, CheckCircle2, Clock, Users,
  ArrowRight, MessageSquare, TrendingUp,
} from 'lucide-react'
import { format, startOfMonth, isAfter } from 'date-fns'

interface Brief {
  id: string
  name: string
  campaign: string | null
  pipeline_status: string
  internal_status: string | null
  draft_url: string | null
  created_at: string
  client_id: string
  clients: { name: string; color: string; slug: string } | null
}

interface Comment {
  id: string
  brief_id: string
  content: string
  user_name: string | null
  is_internal: boolean
  created_at: string
}

export default function Dashboard() {
  const [briefs, setBriefs]     = useState<Brief[]>([])
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading]   = useState(true)
  const router = useRouter()

  useEffect(() => {
    async function load() {
      const supabase = createClient()

      const { data: briefData } = await supabase
        .from('briefs')
        .select('*, clients(name, color, slug)')
        .order('created_at', { ascending: false })

      const { data: commentData } = await supabase
        .from('brief_comments')
        .select('id, brief_id, content, user_name, is_internal, created_at')
        .eq('is_internal', false)
        .order('created_at', { ascending: false })
        .limit(50)

      setBriefs((briefData as unknown as Brief[]) ?? [])
      setComments((commentData as unknown as Comment[]) ?? [])
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

  const monthStart   = startOfMonth(new Date())
  const active       = briefs.filter(b => b.pipeline_status !== 'approved')
  const revisions    = briefs.filter(b => b.internal_status === 'revisions_required')
  const withClient   = briefs.filter(b => b.pipeline_status === 'client_review')
  const approvedMonth = briefs.filter(b => b.pipeline_status === 'approved' && isAfter(new Date(b.created_at), monthStart))

  // Recent client feedback (last 5 unique briefs with comments)
  const recentFeedbackBriefIds = [...new Set(comments.map(c => c.brief_id))].slice(0, 5)
  const recentFeedback: { brief: Brief; comment: Comment }[] = recentFeedbackBriefIds.reduce(
    (acc, id) => {
      const brief = briefs.find(b => b.id === id)
      const latest = comments.find(c => c.brief_id === id)
      if (brief && latest) acc.push({ brief, comment: latest })
      return acc
    },
    [] as { brief: Brief; comment: Comment }[]
  )

  const metrics = [
    {
      label: 'Active Briefs',
      value: active.length,
      icon: TrendingUp,
      bg: 'bg-blue-50',
      iconColor: 'text-blue-500',
      border: 'border-blue-100',
    },
    {
      label: 'Needs Revisions',
      value: revisions.length,
      icon: AlertTriangle,
      bg: revisions.length > 0 ? 'bg-red-50' : 'bg-zinc-50',
      iconColor: revisions.length > 0 ? 'text-red-500' : 'text-zinc-400',
      border: revisions.length > 0 ? 'border-red-100' : 'border-zinc-200',
      urgent: revisions.length > 0,
    },
    {
      label: 'With Client',
      value: withClient.length,
      icon: Clock,
      bg: 'bg-amber-50',
      iconColor: 'text-amber-500',
      border: 'border-amber-100',
    },
    {
      label: 'Approved This Month',
      value: approvedMonth.length,
      icon: CheckCircle2,
      bg: 'bg-green-50',
      iconColor: 'text-green-500',
      border: 'border-green-100',
    },
  ]

  return (
    <div className="p-8 max-w-5xl space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Dashboard</h1>
        <p className="text-sm text-zinc-500 mt-1">{format(new Date(), 'EEEE, d MMMM yyyy')}</p>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {metrics.map(m => (
          <div key={m.label} className={`rounded-2xl border p-5 ${m.bg} ${m.border}`}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">{m.label}</p>
                <p className={`text-3xl font-black mt-1 ${m.urgent ? 'text-red-600' : 'text-zinc-900'}`}>{m.value}</p>
              </div>
              <div className={`h-8 w-8 rounded-xl flex items-center justify-center bg-white/70`}>
                <m.icon className={`h-4 w-4 ${m.iconColor}`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

        {/* Needs Attention */}
        <div className="bg-white rounded-2xl border border-zinc-200">
          <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <h2 className="text-sm font-semibold text-zinc-900">Needs Attention</h2>
            </div>
            <span className="text-xs text-zinc-400">{revisions.length + withClient.length} items</span>
          </div>
          <div className="divide-y divide-zinc-100">
            {[...revisions, ...withClient.filter(b => b.internal_status !== 'revisions_required')].slice(0, 8).map(brief => {
              const isRevision = brief.internal_status === 'revisions_required'
              return (
                <button
                  key={brief.id}
                  onClick={() => router.push(`/pipeline/${brief.clients?.slug}`)}
                  className="w-full flex items-center gap-3 px-5 py-3 hover:bg-zinc-50 transition-colors text-left"
                >
                  <div
                    className="h-2 w-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: isRevision ? '#ef4444' : '#3b82f6' }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-800 truncate">{brief.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {brief.clients && (
                        <span className="text-[10px] font-semibold" style={{ color: brief.clients.color }}>
                          {brief.clients.name}
                        </span>
                      )}
                      <span className={`text-[10px] font-medium ${isRevision ? 'text-red-600' : 'text-blue-600'}`}>
                        {isRevision ? 'Revisions required' : 'Awaiting client approval'}
                      </span>
                    </div>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-zinc-400 flex-shrink-0" />
                </button>
              )
            })}
            {revisions.length === 0 && withClient.length === 0 && (
              <div className="flex flex-col items-center justify-center py-10">
                <CheckCircle2 className="h-6 w-6 text-green-400 mb-2" />
                <p className="text-sm text-zinc-400">All clear — nothing needs attention</p>
              </div>
            )}
          </div>
        </div>

        {/* Recent Client Feedback */}
        <div className="bg-white rounded-2xl border border-zinc-200">
          <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-blue-500" />
              <h2 className="text-sm font-semibold text-zinc-900">Recent Client Feedback</h2>
            </div>
          </div>
          <div className="divide-y divide-zinc-100">
            {recentFeedback.map(({ brief, comment }) => (
              <button
                key={brief.id}
                onClick={() => router.push(`/pipeline/${brief.clients?.slug}`)}
                className="w-full flex items-start gap-3 px-5 py-3 hover:bg-zinc-50 transition-colors text-left"
              >
                <div
                  className="h-6 w-6 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold text-white mt-0.5"
                  style={{ backgroundColor: brief.clients?.color ?? '#14C29F' }}
                >
                  {(brief.clients?.name ?? '?').slice(0, 1)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-zinc-700 truncate">{brief.name}</p>
                  <p className="text-xs text-zinc-500 mt-0.5 line-clamp-2">"{comment.content}"</p>
                  <p className="text-[10px] text-zinc-400 mt-1">{format(new Date(comment.created_at), 'd MMM · h:mm a')}</p>
                </div>
              </button>
            ))}
            {recentFeedback.length === 0 && (
              <div className="flex flex-col items-center justify-center py-10">
                <MessageSquare className="h-6 w-6 text-zinc-300 mb-2" />
                <p className="text-sm text-zinc-400">No client feedback yet</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Per-client pipeline snapshot */}
      <div className="bg-white rounded-2xl border border-zinc-200">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-zinc-500" />
            <h2 className="text-sm font-semibold text-zinc-900">Pipeline by Client</h2>
          </div>
        </div>
        <div className="divide-y divide-zinc-100">
          {(() => {
            const clientMap: Record<string, { name: string; color: string; slug: string; counts: Record<string, number> }> = {}
            briefs.forEach(b => {
              if (!b.client_id || !b.clients) return
              if (!clientMap[b.client_id]) {
                clientMap[b.client_id] = { name: b.clients.name, color: b.clients.color, slug: b.clients.slug, counts: {} }
              }
              const status = b.internal_status ?? 'in_production'
              clientMap[b.client_id].counts[status] = (clientMap[b.client_id].counts[status] ?? 0) + 1
            })
            return Object.entries(clientMap).map(([id, c]) => (
              <button
                key={id}
                onClick={() => router.push(`/pipeline/${c.slug}`)}
                className="w-full flex items-center gap-4 px-5 py-3.5 hover:bg-zinc-50 transition-colors text-left"
              >
                <div className="h-8 w-8 rounded-xl flex items-center justify-center text-white font-bold text-xs flex-shrink-0" style={{ backgroundColor: c.color }}>
                  {c.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-zinc-800">{c.name}</p>
                  <div className="flex gap-3 mt-1 flex-wrap">
                    {[
                      { key: 'in_production', label: 'In Prod', color: 'text-amber-600' },
                      { key: 'revisions_required', label: 'Revisions', color: 'text-red-600' },
                      { key: 'ready_for_review', label: 'Ready', color: 'text-blue-600' },
                      { key: 'approved_by_client', label: 'Approved', color: 'text-green-600' },
                    ].map(s => (
                      <span key={s.key} className={`text-[11px] font-medium ${s.color}`}>
                        {s.label} <span className="font-bold">{c.counts[s.key] ?? 0}</span>
                      </span>
                    ))}
                  </div>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-zinc-400 flex-shrink-0" />
              </button>
            ))
          })()}
        </div>
      </div>
    </div>
  )
}
