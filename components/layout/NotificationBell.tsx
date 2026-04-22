'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Bell, MessageSquare, AlertTriangle, CheckCircle2, X, Check } from 'lucide-react'
import { format, isToday, isYesterday } from 'date-fns'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Notification {
  id: string
  type: 'client_feedback' | 'revisions_required' | 'brief_approved' | string
  brief_id: string
  brief_name: string | null
  client_name: string | null
  client_slug: string | null
  message: string
  read_at: string | null
  resolved_at?: string | null
  created_at: string
}

const TYPE_CONFIG: Record<string, { icon: typeof MessageSquare; color: string; bg: string }> = {
  client_feedback:    { icon: MessageSquare,  color: 'text-blue-400',   bg: 'bg-blue-500/10' },
  revisions_required: { icon: AlertTriangle,  color: 'text-red-400',    bg: 'bg-red-500/10' },
  brief_approved:     { icon: CheckCircle2,   color: 'text-green-400',  bg: 'bg-green-500/10' },
}

function formatTime(iso: string) {
  const d = new Date(iso)
  if (isToday(d)) return format(d, 'h:mm a')
  if (isYesterday(d)) return 'Yesterday'
  return format(d, 'd MMM')
}

export function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [open, setOpen] = useState(false)
  const [resolvedColExists, setResolvedColExists] = useState<boolean | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  // Only count un-resolved + un-read as "new"
  const unread = notifications.filter(n => !n.read_at && !n.resolved_at).length

  async function load() {
    const supabase = createClient()
    // Prefer filtering at the DB level once resolved_at is deployed;
    // fall back to client-side filter pre-migration.
    let firstTry = await supabase
      .from('notifications')
      .select('*')
      .is('resolved_at', null)
      .order('created_at', { ascending: false })
      .limit(40)

    if (firstTry.error) {
      // Column doesn't exist yet — retry without the filter
      firstTry = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(40)
    }

    if (firstTry.error) { setNotifications([]); return }
    const rows = (firstTry.data as Notification[]) ?? []
    setResolvedColExists(rows.some(r => 'resolved_at' in r) ? true : null)
    setNotifications(rows.filter(n => !n.resolved_at))
  }

  async function markAllRead() {
    const unreadIds = notifications.filter(n => !n.read_at).map(n => n.id)
    if (!unreadIds.length) return
    const supabase = createClient()
    await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .in('id', unreadIds)
    setNotifications(prev => prev.map(n => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })))
  }

  async function resolveOne(id: string) {
    const supabase = createClient()
    const payload: Record<string, string> = { read_at: new Date().toISOString(), resolved_at: new Date().toISOString() }
    const { error } = await supabase.from('notifications').update(payload).eq('id', id)
    if (error) {
      // Likely the resolved_at column isn't deployed yet — fall back to read_at only
      await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id)
    }
    setNotifications(prev => prev.filter(n => n.id !== id))
  }

  useEffect(() => {
    load()
    const supabase = createClient()
    const channel = supabase
      .channel('notifications-bell')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => load())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function handleOpen() {
    setOpen(v => !v)
    if (!open) markAllRead()
  }

  function handleNotificationClick(n: Notification) {
    setOpen(false)
    if (n.client_slug) router.push(`/pipeline/${n.client_slug}`)
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={handleOpen}
        aria-label="Notifications"
        className="relative flex items-center justify-center h-9 w-9 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-muted)] hover:bg-[var(--surface-3)] hover:text-[var(--text)] transition-colors"
      >
        <Bell className="h-[18px] w-[18px]" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 h-4 min-w-4 rounded-full bg-red-500 text-white text-[9px] font-bold px-1 flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl overflow-hidden z-50">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-muted)]">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-[var(--text-muted)]" />
              <h3 className="text-sm font-semibold text-[var(--text)]">Notifications</h3>
              {unread > 0 && (
                <span className="rounded-full bg-red-500/15 text-red-400 text-[10px] font-bold px-1.5 py-0.5">
                  {unread} new
                </span>
              )}
            </div>
            <button onClick={() => setOpen(false)} className="text-[var(--text-dim)] hover:text-[var(--text)]">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* List */}
          <div className="max-h-96 overflow-y-auto divide-y divide-[var(--border-muted)]">
            {notifications.length === 0 && (
              <div className="flex flex-col items-center justify-center py-10">
                <Bell className="h-6 w-6 text-[var(--text-dim)] mb-2" />
                <p className="text-xs text-[var(--text-muted)]">You&apos;re all caught up</p>
              </div>
            )}
            {notifications.map(n => {
              const cfg = TYPE_CONFIG[n.type] ?? TYPE_CONFIG.client_feedback
              const Icon = cfg.icon
              const isUnread = !n.read_at
              return (
                <div
                  key={n.id}
                  className={`group flex items-start gap-3 px-4 py-3 transition-colors hover:bg-[var(--surface-2)] ${isUnread ? 'bg-[var(--brand-soft)]/40' : ''}`}
                >
                  <button onClick={() => handleNotificationClick(n)} className="flex flex-1 items-start gap-3 text-left min-w-0">
                    <div className={`h-7 w-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${cfg.bg}`}>
                      <Icon className={`h-3.5 w-3.5 ${cfg.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs leading-snug ${isUnread ? 'font-semibold text-[var(--text)]' : 'text-[var(--text-muted)]'}`}>
                        {n.message}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {n.client_name && <span className="text-[10px] text-[var(--text-dim)]">{n.client_name}</span>}
                        <span className="text-[10px] text-[var(--text-dim)]">{formatTime(n.created_at)}</span>
                      </div>
                    </div>
                  </button>
                  <button
                    onClick={() => resolveOne(n.id)}
                    title="Mark resolved"
                    className="opacity-0 group-hover:opacity-100 flex items-center justify-center h-6 w-6 rounded-md text-[var(--text-dim)] hover:bg-green-500/10 hover:text-green-400 transition"
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                </div>
              )
            })}
          </div>

          {/* Footer */}
          <div className="border-t border-[var(--border-muted)] px-3 py-2">
            <Link
              href="/notifications"
              onClick={() => setOpen(false)}
              className="block w-full rounded-lg px-3 py-1.5 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-2)] text-center transition-colors"
            >
              View all notifications
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
