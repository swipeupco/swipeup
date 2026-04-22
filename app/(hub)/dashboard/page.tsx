'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle, CheckCircle2, ArrowRight, MessageSquare,
  TrendingUp, ExternalLink, Eye, Loader2, Send, Bell, Check,
} from 'lucide-react'
import { format, startOfMonth, isAfter, isToday, isYesterday } from 'date-fns'
import { updateBriefStatus } from '@/lib/pipeline/updateBriefStatus'

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

interface Notification {
  id: string
  type: string
  brief_id: string
  brief_name: string | null
  client_name: string | null
  client_slug: string | null
  message: string
  read_at: string | null
  resolved_at?: string | null
  created_at: string
}

function formatNotifTime(iso: string) {
  const d = new Date(iso)
  if (isToday(d))     return format(d, 'h:mm a')
  if (isYesterday(d)) return 'Yesterday'
  return format(d, 'd MMM')
}

export default function Dashboard() {
  const [briefs, setBriefs] = useState<Brief[]>([])
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [pushing, setPushing] = useState<string | null>(null)
  const router = useRouter()

  async function load() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const [{ data: profile }, { data: briefData }, { data: notifData }] = await Promise.all([
      user
        ? supabase.from('profiles').select('is_admin, hub_role').eq('id', user.id).single()
        : Promise.resolve({ data: null, error: null }),
      supabase
        .from('briefs')
        .select('id, name, campaign, pipeline_status, internal_status, draft_url, created_at, client_id, clients(name, color, slug)')
        .order('created_at', { ascending: false }),
      supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(40),
    ])

    const p = profile as { is_admin?: boolean; hub_role?: string | null } | null
    setIsAdmin(p?.hub_role === 'admin' || p?.is_admin === true)
    setBriefs((briefData as unknown as Brief[]) ?? [])
    setNotifications(((notifData as Notification[]) ?? []).filter(n => !n.resolved_at))
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function pushToClient(brief: Brief) {
    setPushing(brief.id)
    try {
      await updateBriefStatus(brief.id, { pipeline_status: 'client_review', internal_status: 'in_review' })
      setBriefs(prev => prev.map(b =>
        b.id === brief.id ? { ...b, pipeline_status: 'client_review', internal_status: 'in_review' } : b
      ))
    } finally {
      setPushing(null)
    }
  }

  async function resolveNotification(id: string) {
    const supabase = createClient()
    const payload = { resolved_at: new Date().toISOString(), read_at: new Date().toISOString() }
    const { error } = await supabase.from('notifications').update(payload).eq('id', id)
    if (error) {
      // resolved_at column may not exist yet — fall back to read_at
      await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id)
    }
    setNotifications(prev => prev.filter(n => n.id !== id))
  }

  const monthStart    = startOfMonth(new Date())
  const active        = useMemo(() => briefs.filter(b => b.pipeline_status !== 'approved'), [briefs])
  const revisions     = useMemo(() => briefs.filter(b => b.internal_status === 'revisions_required'), [briefs])
  const withClient    = useMemo(() => briefs.filter(b => b.pipeline_status === 'client_review'), [briefs])
  const approvedMonth = useMemo(() => briefs.filter(b =>
    b.pipeline_status === 'approved' && isAfter(new Date(b.created_at), monthStart)
  ), [briefs, monthStart])
  const readyToReview = useMemo(() =>
    briefs.filter(b => b.internal_status === 'in_review' && !!b.draft_url),
  [briefs])

  const metrics = [
    { label: 'Active briefs',        value: active.length,        icon: TrendingUp,   accent: 'text-[var(--text)]' },
    { label: 'Ready to review',      value: readyToReview.length, icon: Eye,          accent: readyToReview.length > 0 ? 'text-[var(--brand)]' : 'text-[var(--text-dim)]', highlight: readyToReview.length > 0 },
    { label: 'Needs revisions',      value: revisions.length,     icon: AlertTriangle, accent: revisions.length > 0 ? 'text-red-400' : 'text-[var(--text-dim)]', urgent: revisions.length > 0 },
    { label: 'Approved this month',  value: approvedMonth.length, icon: CheckCircle2,  accent: 'text-emerald-400' },
  ]

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="h-6 w-6 animate-spin text-[var(--brand)]" />
    </div>
  )

  return (
    <div className="p-8 max-w-5xl space-y-6">

      <div>
        <h1 className="text-2xl font-bold text-[var(--text)]">Dashboard</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">{format(new Date(), 'EEEE, d MMMM yyyy')}</p>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {metrics.map(m => {
          const borderClass =
            'urgent' in m && m.urgent ? 'border-red-500/30 bg-red-500/5' :
            'highlight' in m && m.highlight ? 'border-[var(--brand)]/30 bg-[var(--brand-soft)]' :
            'border-[var(--border)] bg-[var(--surface)]'
          return (
            <div key={m.label} className={`rounded-2xl border p-5 ${borderClass}`}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">{m.label}</p>
                  <p className={`text-3xl font-black mt-1 ${m.accent}`}>{m.value}</p>
                </div>
                <div className="h-8 w-8 rounded-xl flex items-center justify-center bg-[var(--surface-2)]">
                  <m.icon className={`h-4 w-4 ${m.accent}`} />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Ready to Review (admin) */}
      {isAdmin && (
        <div className="bg-[var(--surface)] rounded-2xl border border-[var(--brand)]/30">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-muted)]">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-[var(--brand)] animate-pulse" />
              <h2 className="text-sm font-semibold text-[var(--text)]">Ready to review</h2>
              {readyToReview.length > 0 && (
                <span className="text-xs font-semibold text-white bg-[var(--brand)] rounded-full px-2 py-0.5">
                  {readyToReview.length}
                </span>
              )}
            </div>
            <p className="text-xs text-[var(--text-muted)]">Drafts awaiting review before sending to clients</p>
          </div>
          {readyToReview.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2">
              <CheckCircle2 className="h-6 w-6 text-[var(--text-dim)]" />
              <p className="text-sm text-[var(--text-muted)]">No drafts waiting for review</p>
            </div>
          ) : (
            <div className="divide-y divide-[var(--border-muted)]">
              {readyToReview.map(brief => (
                <div key={brief.id} className="flex items-center gap-4 px-5 py-4">
                  <div
                    className="h-8 w-8 rounded-xl flex items-center justify-center text-white font-bold text-xs flex-shrink-0"
                    style={{ backgroundColor: brief.clients?.color ?? '#4950F8' }}
                  >
                    {(brief.clients?.name ?? '?').slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[var(--text)] truncate">{brief.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {brief.clients && (
                        <span className="text-[11px] font-semibold" style={{ color: brief.clients.color }}>
                          {brief.clients.name}
                        </span>
                      )}
                      {brief.campaign && (
                        <span className="text-[11px] text-[var(--text-dim)]">· {brief.campaign}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {brief.draft_url && (
                      <a
                        href={brief.draft_url}
                        target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-1.5 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-3)] transition-colors"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        View draft
                      </a>
                    )}
                    <button
                      onClick={() => router.push(`/pipeline/${brief.clients?.slug}`)}
                      className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-1.5 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-3)] transition-colors"
                    >
                      <MessageSquare className="h-3.5 w-3.5" />
                      Feedback
                    </button>
                    <button
                      onClick={() => pushToClient(brief)}
                      disabled={pushing === brief.id}
                      className="flex items-center gap-1.5 rounded-lg bg-[var(--brand)] hover:bg-[var(--brand-hover)] px-3 py-1.5 text-xs font-semibold text-white transition-colors disabled:opacity-60"
                    >
                      {pushing === brief.id
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <Send className="h-3.5 w-3.5" />
                      }
                      Send to client
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 2-col grid: Needs Attention + Unresolved Notifications */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">

        <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)]">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-muted)]">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-400" />
              <h2 className="text-sm font-semibold text-[var(--text)]">Needs attention</h2>
            </div>
            <span className="text-xs text-[var(--text-muted)]">{revisions.length + withClient.length} items</span>
          </div>
          <div className="divide-y divide-[var(--border-muted)]">
            {[...revisions, ...withClient.filter(b => b.internal_status !== 'revisions_required')].slice(0, 8).map(brief => {
              const isRevision = brief.internal_status === 'revisions_required'
              return (
                <button
                  key={brief.id}
                  onClick={() => router.push(`/pipeline/${brief.clients?.slug}`)}
                  className="w-full flex items-center gap-3 px-5 py-3 hover:bg-[var(--surface-2)] transition-colors text-left"
                >
                  <div className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: isRevision ? '#ef4444' : '#4950F8' }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--text)] truncate">{brief.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {brief.clients && (
                        <span className="text-[10px] font-semibold" style={{ color: brief.clients.color }}>
                          {brief.clients.name}
                        </span>
                      )}
                      <span className={`text-[10px] font-medium ${isRevision ? 'text-red-400' : 'text-[var(--brand)]'}`}>
                        {isRevision ? 'Revisions required' : 'Awaiting client approval'}
                      </span>
                    </div>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-[var(--text-dim)] flex-shrink-0" />
                </button>
              )
            })}
            {revisions.length === 0 && withClient.length === 0 && (
              <div className="flex flex-col items-center justify-center py-10">
                <CheckCircle2 className="h-6 w-6 text-emerald-400 mb-2" />
                <p className="text-sm text-[var(--text-muted)]">All clear</p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)]">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-muted)]">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-[var(--brand)]" />
              <h2 className="text-sm font-semibold text-[var(--text)]">Unresolved notifications</h2>
              {notifications.length > 0 && (
                <span className="text-[10px] font-bold rounded-full px-1.5 py-0.5 bg-[var(--brand-soft)] text-[var(--brand)]">
                  {notifications.length}
                </span>
              )}
            </div>
          </div>
          <div className="divide-y divide-[var(--border-muted)] max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2">
                <Bell className="h-6 w-6 text-[var(--text-dim)]" />
                <p className="text-sm text-[var(--text-muted)]">You&apos;re all caught up</p>
              </div>
            ) : notifications.slice(0, 10).map(n => (
              <div
                key={n.id}
                className="group flex items-start gap-3 px-5 py-3 hover:bg-[var(--surface-2)] transition-colors"
              >
                <button
                  onClick={() => n.client_slug && router.push(`/pipeline/${n.client_slug}`)}
                  className="flex flex-1 items-start gap-3 text-left min-w-0"
                >
                  <div className="h-2 w-2 rounded-full bg-[var(--brand)] flex-shrink-0 mt-1.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--text)] leading-snug">{n.message}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {n.client_name && (
                        <span className="text-[10px] text-[var(--text-dim)]">{n.client_name}</span>
                      )}
                      <span className="text-[10px] text-[var(--text-dim)]">{formatNotifTime(n.created_at)}</span>
                    </div>
                  </div>
                </button>
                <button
                  onClick={() => resolveNotification(n.id)}
                  title="Mark resolved"
                  className="opacity-0 group-hover:opacity-100 flex items-center justify-center h-7 w-7 rounded-md text-[var(--text-dim)] hover:bg-emerald-500/10 hover:text-emerald-400 transition"
                >
                  <Check className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
