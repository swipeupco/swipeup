'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Bell, Settings, CheckCheck } from 'lucide-react'
import { formatDistanceToNowStrict } from 'date-fns'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type NotificationRow = {
  id: string
  user_id: string
  actor_id: string | null
  comment_id: string | null
  event_type: string | null
  brief_id: string | null
  brief_name: string | null
  client_slug: string | null
  message: string
  link: string | null
  read_at: string | null
  created_at: string
  actor?: { name: string | null; avatar_url: string | null } | null
  comment?: { content: string | null } | null
}

function initials(name: string | null | undefined) {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : parts[0].slice(0, 2).toUpperCase()
}

function describeAction(ev: string | null): string {
  switch (ev) {
    case 'mentioned':        return 'mentioned you'
    case 'new_comment':      return 'commented'
    case 'ready_for_review': return 'is ready for review'
    case 'status_change':    return 'updated the status'
    default:                 return 'notified you'
  }
}

function relative(iso: string): string {
  try {
    return formatDistanceToNowStrict(new Date(iso), { addSuffix: true })
      .replace('seconds', 's').replace('second', 's')
      .replace('minutes', 'm').replace('minute', 'm')
      .replace('hours', 'h').replace('hour', 'h')
      .replace('days', 'd').replace('day', 'd')
  } catch { return '' }
}

export function NotificationBell() {
  const router = useRouter()
  const [items, setItems] = useState<NotificationRow[]>([])
  const [open, setOpen] = useState(false)
  const [justArrived, setJustArrived] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  const unread = items.filter(n => !n.read_at).length

  async function fetchNotifications() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setItems([]); return }
    const { data } = await supabase
      .from('notifications')
      .select('*, actor:profiles!notifications_actor_id_fkey(name, avatar_url), comment:brief_comments!notifications_comment_id_fkey(content)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(30)
    setItems((data as NotificationRow[]) ?? [])
  }

  useEffect(() => { fetchNotifications() }, [])

  // Realtime subscription scoped to this user
  useEffect(() => {
    const supabase = createClient()
    let unsub: (() => void) | null = null
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      const channel = supabase
        .channel(`notifications-${user.id}`)
        .on('postgres_changes', {
          event: 'INSERT', schema: 'public', table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        }, () => {
          setJustArrived(true)
          fetchNotifications()
          setTimeout(() => setJustArrived(false), 1200)
        })
        .on('postgres_changes', {
          event: 'UPDATE', schema: 'public', table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        }, fetchNotifications)
        .subscribe()
      unsub = () => { supabase.removeChannel(channel) }
    })
    return () => { if (unsub) unsub() }
  }, [])

  // Close on outside click / Escape
  useEffect(() => {
    if (!open) return
    function onClick(e: MouseEvent) {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        buttonRef.current && !buttonRef.current.contains(e.target as Node)
      ) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  async function markRead(id: string) {
    const supabase = createClient()
    const now = new Date().toISOString()
    setItems(prev => prev.map(n => n.id === id ? { ...n, read_at: now } : n))
    await supabase.from('notifications').update({ read_at: now, resolved: true }).eq('id', id)
  }

  async function markAllRead() {
    const supabase = createClient()
    const unreadIds = items.filter(n => !n.read_at).map(n => n.id)
    if (!unreadIds.length) return
    const now = new Date().toISOString()
    setItems(prev => prev.map(n => ({ ...n, read_at: n.read_at ?? now })))
    await supabase.from('notifications').update({ read_at: now, resolved: true }).in('id', unreadIds)
  }

  function openNotification(n: NotificationRow) {
    markRead(n.id)
    setOpen(false)
    if (n.link) {
      if (n.link.startsWith('/')) router.push(n.link)
      else window.open(n.link, '_blank')
    }
  }

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={() => setOpen(v => !v)}
        aria-label="Notifications"
        className="relative flex items-center justify-center h-9 w-9 rounded-xl text-gray-500 hover:bg-gray-100 hover:text-gray-800 transition-colors"
      >
        <Bell className="h-[18px] w-[18px]" />
        {unread > 0 && (
          <span
            className={`absolute top-1.5 right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white ring-2 ring-white ${justArrived ? 'animate-bell-pulse' : ''}`}
          >
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={panelRef}
          className="absolute right-0 top-full mt-2 w-[380px] rounded-2xl bg-white border border-gray-200 shadow-xl overflow-hidden z-50 origin-top-right animate-bell-in"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <p className="text-sm font-semibold text-gray-900">Notifications</p>
            {unread > 0 && (
              <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">{unread} unread</span>
            )}
          </div>

          {/* List */}
          <div className="max-h-[440px] overflow-y-auto">
            {items.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <div className="mx-auto h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                  <Bell className="h-5 w-5 text-gray-400" />
                </div>
                <p className="text-sm font-medium text-gray-700">No notifications yet</p>
                <p className="text-xs text-gray-400 mt-1">We&apos;ll ping you when someone tags or mentions you.</p>
              </div>
            ) : (
              items.map(n => {
                const isUnread = !n.read_at
                const actorName = n.actor?.name ?? 'Someone'
                const action = describeAction(n.event_type)
                const snippet = n.comment?.content
                  ? (n.comment.content.length > 100 ? n.comment.content.slice(0, 100) + '…' : n.comment.content)
                  : null
                return (
                  <button
                    key={n.id}
                    onClick={() => openNotification(n)}
                    className={`w-full flex gap-3 px-4 py-3 text-left transition-colors border-l-[3px] ${
                      isUnread
                        ? 'bg-[#4950F8]/[0.04] border-l-[#4950F8] hover:bg-[#4950F8]/[0.08]'
                        : 'border-l-transparent hover:bg-gray-50'
                    }`}
                  >
                    <div className="h-9 w-9 rounded-full flex items-center justify-center text-white text-[11px] font-bold overflow-hidden flex-shrink-0" style={{ backgroundColor: '#4950F8' }}>
                      {n.actor?.avatar_url
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={n.actor.avatar_url} alt="" className="h-full w-full object-cover" />
                        : initials(actorName)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-1">
                        <p className="text-sm font-semibold text-gray-900 truncate">{n.brief_name ?? 'Brief'}</p>
                      </div>
                      <p className="text-xs text-gray-600 mt-0.5">
                        <span className="font-medium text-gray-800">{actorName}</span>{' '}{action}
                      </p>
                      {snippet && (
                        <p className="text-xs text-gray-500 mt-1 line-clamp-2">“{snippet}”</p>
                      )}
                      <p className="text-[10px] text-gray-400 mt-1">{relative(n.created_at)}</p>
                    </div>
                    {isUnread && (
                      <span className="h-2 w-2 rounded-full bg-[#4950F8] flex-shrink-0 mt-1.5" />
                    )}
                  </button>
                )
              })
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-4 py-2.5 border-t border-gray-100 bg-gray-50/60">
            {unread > 0 ? (
              <button
                onClick={markAllRead}
                className="flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 transition-colors"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Mark all as read
              </button>
            ) : (
              <span />
            )}
            <Link
              href="/settings#notifications"
              onClick={() => setOpen(false)}
              className="flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 transition-colors"
            >
              <Settings className="h-3.5 w-3.5" />
              Notification settings
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
