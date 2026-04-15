'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Bell, MessageSquare, AlertTriangle, CheckCircle2, X } from 'lucide-react'
import { format, isToday, isYesterday } from 'date-fns'
import { useRouter } from 'next/navigation'

interface Notification {
  id: string
  type: 'client_feedback' | 'revisions_required' | 'brief_approved'
  brief_id: string
  brief_name: string | null
  client_name: string | null
  client_slug: string | null
  message: string
  read_at: string | null
  created_at: string
}

const TYPE_CONFIG = {
  client_feedback:   { icon: MessageSquare, color: 'text-blue-500',  bg: 'bg-blue-50' },
  revisions_required:{ icon: AlertTriangle,  color: 'text-red-500',   bg: 'bg-red-50' },
  brief_approved:    { icon: CheckCircle2,   color: 'text-green-500', bg: 'bg-green-50' },
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
  const panelRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  const unread = notifications.filter(n => !n.read_at).length

  async function load() {
    const supabase = createClient()
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(40)
    setNotifications((data as Notification[]) ?? [])
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

  // Realtime subscription
  useEffect(() => {
    load()
    const supabase = createClient()
    const channel = supabase
      .channel('notifications-bell')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, () => load())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
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
    if (n.client_slug) {
      router.push(`/pipeline/${n.client_slug}`)
    }
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={handleOpen}
        className="relative flex items-center justify-center h-8 w-8 rounded-lg text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
      >
        <Bell className="h-[18px] w-[18px]" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-full top-0 ml-2 w-80 bg-white rounded-2xl shadow-2xl border border-zinc-200 overflow-hidden z-50">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-zinc-500" />
              <h3 className="text-sm font-semibold text-zinc-900">Notifications</h3>
              {unread > 0 && (
                <span className="rounded-full bg-red-100 text-red-600 text-[10px] font-bold px-1.5 py-0.5">
                  {unread} new
                </span>
              )}
            </div>
            <button onClick={() => setOpen(false)} className="text-zinc-400 hover:text-zinc-600">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* List */}
          <div className="max-h-96 overflow-y-auto divide-y divide-zinc-50">
            {notifications.length === 0 && (
              <div className="flex flex-col items-center justify-center py-10">
                <Bell className="h-6 w-6 text-zinc-300 mb-2" />
                <p className="text-xs text-zinc-400">No notifications yet</p>
              </div>
            )}
            {notifications.map(n => {
              const cfg = TYPE_CONFIG[n.type] ?? TYPE_CONFIG.client_feedback
              const Icon = cfg.icon
              const isUnread = !n.read_at
              return (
                <button
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  className={`w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-zinc-50 transition-colors ${isUnread ? 'bg-blue-50/40' : ''}`}
                >
                  <div className={`h-7 w-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${cfg.bg}`}>
                    <Icon className={`h-3.5 w-3.5 ${cfg.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs leading-snug ${isUnread ? 'font-semibold text-zinc-900' : 'text-zinc-700'}`}>
                      {n.message}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {n.client_name && (
                        <span className="text-[10px] text-zinc-400">{n.client_name}</span>
                      )}
                      <span className="text-[10px] text-zinc-400">{formatTime(n.created_at)}</span>
                    </div>
                  </div>
                  {isUnread && (
                    <div className="h-2 w-2 rounded-full bg-blue-500 flex-shrink-0 mt-1.5" />
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
