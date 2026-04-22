'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Bell, MessageSquare, AlertTriangle, CheckCircle2, Check, Loader2, Undo2 } from 'lucide-react'
import { format, isToday, isYesterday } from 'date-fns'

interface Notification {
  id: string
  type: string
  brief_id: string
  brief_name: string | null
  client_name: string | null
  client_slug: string | null
  message: string
  read_at: string | null
  resolved_at: string | null
  created_at: string
}

const TYPE_CONFIG: Record<string, { icon: typeof MessageSquare; color: string; bg: string }> = {
  client_feedback:    { icon: MessageSquare,  color: 'text-blue-400',   bg: 'bg-blue-500/10' },
  revisions_required: { icon: AlertTriangle,  color: 'text-red-400',    bg: 'bg-red-500/10' },
  brief_approved:     { icon: CheckCircle2,   color: 'text-green-400',  bg: 'bg-green-500/10' },
}

function formatTime(iso: string) {
  const d = new Date(iso)
  if (isToday(d)) return `Today · ${format(d, 'h:mm a')}`
  if (isYesterday(d)) return `Yesterday · ${format(d, 'h:mm a')}`
  return format(d, 'd MMM yyyy · h:mm a')
}

export default function NotificationsPage() {
  const [tab, setTab] = useState<'unresolved' | 'resolved'>('unresolved')
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  async function load() {
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200)
    setNotifications((data as Notification[]) ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function resolveOne(id: string) {
    const supabase = createClient()
    const now = new Date().toISOString()
    const { error } = await supabase.from('notifications').update({ resolved_at: now, read_at: now }).eq('id', id)
    if (error) {
      await supabase.from('notifications').update({ read_at: now }).eq('id', id)
    }
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, resolved_at: now, read_at: now } : n))
  }

  async function reopenOne(id: string) {
    const supabase = createClient()
    const { error } = await supabase.from('notifications').update({ resolved_at: null }).eq('id', id)
    if (error) return
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, resolved_at: null } : n))
  }

  const filtered = notifications.filter(n => tab === 'unresolved' ? !n.resolved_at : !!n.resolved_at)
  const unresolvedCount = notifications.filter(n => !n.resolved_at).length
  const resolvedCount   = notifications.filter(n => !!n.resolved_at).length

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text)]">Notifications</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">Your full notification history, resolved and unresolved.</p>
        </div>
      </div>

      <div className="flex gap-1 mb-4 p-1 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] w-fit">
        <TabButton active={tab === 'unresolved'} onClick={() => setTab('unresolved')} label="Unresolved" count={unresolvedCount} />
        <TabButton active={tab === 'resolved'}   onClick={() => setTab('resolved')}   label="Resolved"   count={resolvedCount} />
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-[var(--brand)]" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Bell className="h-8 w-8 text-[var(--text-dim)]" />
            <p className="text-sm font-medium text-[var(--text)]">
              {tab === 'unresolved' ? "You're all caught up" : 'No resolved notifications yet'}
            </p>
            <p className="text-xs text-[var(--text-muted)]">
              {tab === 'unresolved'
                ? 'Resolved notifications move to the Resolved tab.'
                : 'Items moved to this list when you hit the green tick in the bell or here.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--border-muted)]">
            {filtered.map(n => {
              const cfg = TYPE_CONFIG[n.type] ?? TYPE_CONFIG.client_feedback
              const Icon = cfg.icon
              return (
                <div key={n.id} className="flex items-start gap-3 px-5 py-3 hover:bg-[var(--surface-2)] transition-colors">
                  <div className={`h-8 w-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${cfg.bg}`}>
                    <Icon className={`h-4 w-4 ${cfg.color}`} />
                  </div>
                  <button
                    onClick={() => n.client_slug && router.push(`/pipeline/${n.client_slug}`)}
                    className="flex-1 min-w-0 text-left"
                  >
                    <p className={`text-sm leading-snug ${n.resolved_at ? 'text-[var(--text-muted)]' : 'font-semibold text-[var(--text)]'}`}>
                      {n.message}
                    </p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {n.client_name && (
                        <span className="text-[11px] font-semibold text-[var(--text-muted)]">{n.client_name}</span>
                      )}
                      <span className="text-[11px] text-[var(--text-dim)]">{formatTime(n.created_at)}</span>
                      {n.resolved_at && (
                        <span className="text-[10px] text-emerald-400 bg-emerald-500/10 rounded-full px-1.5 py-0.5 border border-emerald-500/30">
                          Resolved {formatTime(n.resolved_at)}
                        </span>
                      )}
                    </div>
                  </button>
                  {n.resolved_at ? (
                    <button
                      onClick={() => reopenOne(n.id)}
                      title="Reopen"
                      className="flex items-center justify-center h-7 w-7 rounded-md text-[var(--text-dim)] hover:bg-[var(--brand-soft)] hover:text-[var(--brand)] transition"
                    >
                      <Undo2 className="h-3.5 w-3.5" />
                    </button>
                  ) : (
                    <button
                      onClick={() => resolveOne(n.id)}
                      title="Mark resolved"
                      className="flex items-center justify-center h-7 w-7 rounded-md text-[var(--text-dim)] hover:bg-emerald-500/10 hover:text-emerald-400 transition"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function TabButton({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count: number }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
        active ? 'bg-[var(--surface)] text-[var(--text)] shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text)]'
      }`}
    >
      {label}
      <span className={`rounded-full text-[10px] font-bold px-1.5 py-0.5 ${
        active ? 'bg-[var(--brand)] text-white' : 'bg-[var(--surface-3)] text-[var(--text)]'
      }`}>
        {count}
      </span>
    </button>
  )
}
