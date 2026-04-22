'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  X, ExternalLink, Send, Lock, MessageSquare, Link as LinkIcon,
  ArrowRight, CheckCircle2, AlertTriangle,
} from 'lucide-react'
import { format } from 'date-fns'
import { CLIENT_STAGES, CLIENT_STAGE_LABELS, INTERNAL_STAGES, INTERNAL_STAGE_BADGES } from '@/lib/pipeline/stages'
import { updateBriefStatus } from '@/lib/pipeline/updateBriefStatus'
import TagUsersControl from '@/components/briefs/TagUsersControl'

// ─── Interfaces ───────────────────────────────────────────────────────────────

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
  cover_url?: string | null
  created_by?: string | null
  creator?: { id: string; name: string | null; avatar_url: string | null } | null
  tagged_users?: { id: string; name: string | null; avatar_url: string | null }[]
}

interface Comment {
  id: string
  content: string
  user_email: string | null
  user_name: string | null
  is_internal: boolean
  created_at: string
}

interface Props {
  brief: Brief
  clientColor: string
  clientName?: string
  onClose: () => void
  onMove: (id: string, stage: string) => void
  onInternalMove?: (id: string, stage: string) => void
  onRefresh: () => void
  onBriefUpdate?: (updates: Partial<Brief>) => void
  internalMode?: boolean
}

const CLIENT_STAGE_KEYS = CLIENT_STAGES.map(s => s.key)

// ─── Avatar helper ────────────────────────────────────────────────────────────

function Avatar({ name, email, size = 32 }: { name: string | null; email: string | null; size?: number }) {
  const label  = name ?? email?.split('@')[0] ?? '?'
  const initials = label.slice(0, 2).toUpperCase()
  // Deterministic colour from name
  const colors = ['#6366f1','#8b5cf6','#ec4899','#14b8a6','#f59e0b','#10b981','#3b82f6']
  const color  = colors[(label.charCodeAt(0) ?? 0) % colors.length]
  return (
    <div
      className="rounded-full flex items-center justify-center text-white font-bold flex-shrink-0"
      style={{ width: size, height: size, backgroundColor: color, fontSize: size * 0.38 }}
    >
      {initials}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function BriefDrawer({
  brief, clientColor, clientName, onClose, onMove, onInternalMove,
  onRefresh, onBriefUpdate, internalMode,
}: Props) {
  const [comments, setComments]     = useState<Comment[]>([])
  const [newComment, setNewComment] = useState('')
  const [isInternal, setIsInternal] = useState(internalMode ?? false)
  const [sending, setSending]       = useState(false)
  const [draftUrl, setDraftUrl]     = useState(brief.draft_url ?? '')
  const [savingUrl, setSavingUrl]   = useState(false)
  const [urlSaved, setUrlSaved]     = useState(false)
  const [currentUserName, setCurrentUserName] = useState<string | null>(null)
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null)
  const [mentionUsers, setMentionUsers] = useState<{ id: string; name: string }[]>([])
  const [mentionOpen, setMentionOpen]   = useState(false)
  const [mentionQuery, setMentionQuery] = useState('')
  const [mentionStart, setMentionStart] = useState(0)
  const [mentionIndex, setMentionIndex] = useState(0)
  const [pendingMentionIds, setPendingMentionIds] = useState<string[]>([])
  const commentsEndRef = useRef<HTMLDivElement>(null)
  const textareaRef    = useRef<HTMLTextAreaElement>(null)

  const internalStatus  = brief.internal_status ?? 'in_production'
  const clientIndex     = CLIENT_STAGE_KEYS.indexOf(brief.pipeline_status)
  const nextClientStage      = clientIndex < CLIENT_STAGE_KEYS.length - 1 ? CLIENT_STAGE_KEYS[clientIndex + 1] : null

  const clientComments   = comments.filter(c => !c.is_internal)
  const internalComments = comments.filter(c => c.is_internal)
  const hasClientFeedback = clientComments.length > 0

  // Sync draft URL from prop
  useEffect(() => { setDraftUrl(brief.draft_url ?? '') }, [brief.draft_url])

  async function loadComments() {
    const supabase = createClient()
    const { data } = await supabase
      .from('brief_comments')
      .select('*')
      .eq('brief_id', brief.id)
      .order('created_at', { ascending: true })
    setComments((data as Comment[]) ?? [])
  }

  // Load mentionable users scoped to this brief's client board:
  //  - profiles where client_id = brief.client_id (client members)
  //  - staff with access to this client via staff_client_access
  // Self is included so users can @mention themselves.
  useEffect(() => {
    const supabase = createClient()
    ;(async () => {
      const [clientRes, staffRes] = await Promise.all([
        supabase.from('profiles').select('id, name').eq('client_id', brief.client_id),
        supabase.from('staff_client_access').select('staff_id').eq('client_id', brief.client_id),
      ])
      const staffIds = (staffRes.data ?? []).map(r => r.staff_id as string)
      const staffProfiles = staffIds.length
        ? (await supabase.from('profiles').select('id, name').in('id', staffIds)).data ?? []
        : []
      const merged: Record<string, { id: string; name: string }> = {}
      ;[...(clientRes.data ?? []), ...staffProfiles].forEach(p => {
        if (p.name) merged[p.id] = { id: p.id, name: p.name }
      })
      setMentionUsers(Object.values(merged).sort((a, b) => a.name.localeCompare(b.name)))
    })()
  }, [brief.client_id])

  useEffect(() => {
    loadComments()

    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setCurrentUserEmail(user.email ?? null)
        supabase.from('profiles').select('name').eq('id', user.id).single()
          .then(({ data }) => setCurrentUserName(data?.name ?? null))
      }
    })

    const channel = supabase
      .channel(`comments-${brief.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'brief_comments',
        filter: `brief_id=eq.${brief.id}`,
      }, () => loadComments())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brief.id])

  useEffect(() => {
    commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [comments])

  const filteredMentions = mentionUsers.filter(u =>
    u.name.toLowerCase().includes(mentionQuery.toLowerCase())
  )

  function handleCommentChange(value: string) {
    setNewComment(value)
    const cursorPos = textareaRef.current?.selectionStart ?? value.length
    const textBefore = value.slice(0, cursorPos)
    const atMatch = textBefore.match(/@(\w*)$/)
    if (atMatch) {
      setMentionQuery(atMatch[1])
      setMentionStart(cursorPos - atMatch[0].length)
      setMentionOpen(true)
      setMentionIndex(0)
    } else {
      setMentionOpen(false)
    }
  }

  function insertMention(user: { id: string; name: string }) {
    const before = newComment.slice(0, mentionStart)
    const after  = newComment.slice(mentionStart + mentionQuery.length + 1)
    const mention = `@${user.name} `
    setNewComment(before + mention + after)
    setMentionOpen(false)
    setMentionIndex(0)
    setPendingMentionIds(ids => Array.from(new Set([...ids, user.id])))
    setTimeout(() => textareaRef.current?.focus(), 10)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (mentionOpen && filteredMentions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault(); setMentionIndex(i => Math.min(i + 1, filteredMentions.length - 1)); return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault(); setMentionIndex(i => Math.max(i - 1, 0)); return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        const pick = filteredMentions[mentionIndex] ?? filteredMentions[0]
        if (pick) insertMention(pick)
        return
      }
      if (e.key === 'Escape') { e.preventDefault(); setMentionOpen(false); return }
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      sendComment()
    }
  }

  async function sendComment() {
    if (!newComment.trim()) return
    setSending(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const text = newComment.trim()
    const { data: inserted } = await supabase.from('brief_comments').insert({
      brief_id:    brief.id,
      content:     text,
      user_id:     user?.id,
      user_email:  user?.email,
      user_name:   currentUserName ?? user?.email?.split('@')[0] ?? 'Team',
      is_internal: isInternal,
    }).select('id').single()

    // Persist mentions so notify_on_comment trigger fires the right fan-out
    const mentionIdsInText = pendingMentionIds.filter(uid => {
      const u = mentionUsers.find(m => m.id === uid)
      return u ? text.includes(`@${u.name}`) : false
    })
    if (inserted?.id && mentionIdsInText.length > 0) {
      await supabase.from('comment_mentions').insert(
        mentionIdsInText.map(uid => ({ comment_id: inserted.id, user_id: uid }))
      )
    }

    setNewComment('')
    setPendingMentionIds([])
    setSending(false)
    await loadComments()
  }

  function renderCommentContent(content: string) {
    // Match only single-word @handles so trailing text stays default-coloured
    const parts = content.split(/(@[\w-]+)/g)
    return parts.map((part, i) =>
      /^@[\w-]+$/.test(part)
        ? <span key={i} className="font-semibold" style={{ color: '#4950F8' }}>{part}</span>
        : <span key={i}>{part}</span>
    )
  }

  async function saveDraftUrl() {
    if (!draftUrl.trim()) return
    setSavingUrl(true)
    const updates = await updateBriefStatus(brief.id, {
      draft_url: draftUrl.trim(),
      internal_status: 'in_review',
    })
    setSavingUrl(false)
    setUrlSaved(true)
    onBriefUpdate?.(updates)
    onRefresh()
    setTimeout(() => setUrlSaved(false), 2000)
  }

  async function pushToClientReview() {
    const updates = await updateBriefStatus(brief.id, {
      pipeline_status: 'client_review',
      internal_status: 'in_review',
    })
    onMove(brief.id, 'client_review')
    onBriefUpdate?.(updates)
  }

  async function markApprovedByClient() {
    const updates = await updateBriefStatus(brief.id, {
      pipeline_status: 'approved',
      internal_status: 'approved_by_client',
    })
    onMove(brief.id, 'approved')
    onInternalMove?.(brief.id, 'approved_by_client')
    onBriefUpdate?.(updates)
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">

        {/* ── Cover image ── */}
        {brief.cover_url && (
          <div className="flex-shrink-0 w-full bg-black/80 max-h-48 overflow-hidden rounded-t-2xl">
            <img
              src={brief.cover_url}
              alt=""
              className="w-full max-h-48 object-contain"
            />
          </div>
        )}

        {/* ── Coloured header ── */}
        <div
          className="flex-shrink-0 px-6 py-4"
          style={{ backgroundColor: clientColor }}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              {brief.campaign && (
                <p className="text-xs font-medium mb-1" style={{ color: 'rgba(255,255,255,0.7)' }}>
                  {brief.campaign}
                </p>
              )}
              <h2 className="font-bold text-white text-lg leading-snug">{brief.name}</h2>

              {/* Badges row */}
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                {clientName && internalMode && (
                  <span className="text-[11px] font-semibold text-white/90 bg-white/20 rounded-full px-2.5 py-0.5">
                    {clientName}
                  </span>
                )}
                {brief.content_type && (
                  <span className="text-[11px] font-semibold text-white/90 bg-white/20 rounded-full px-2.5 py-0.5">
                    {brief.content_type}
                  </span>
                )}
                {internalMode && (
                  <span className={`text-[11px] font-semibold rounded-full px-2.5 py-0.5 ${INTERNAL_STAGE_BADGES[internalStatus]}`}>
                    {INTERNAL_STAGES.find(s => s.key === internalStatus)?.label}
                  </span>
                )}
                {internalMode && (
                  <span className="text-[11px] font-medium text-white/60 bg-white/10 rounded-full px-2.5 py-0.5">
                    Client: {CLIENT_STAGE_LABELS[brief.pipeline_status] ?? brief.pipeline_status}
                  </span>
                )}
                {!internalMode && (
                  <span className="text-[11px] font-semibold text-white/90 bg-white/20 rounded-full px-2.5 py-0.5">
                    {CLIENT_STAGE_LABELS[brief.pipeline_status]}
                  </span>
                )}
              </div>
            </div>

            <button
              onClick={onClose}
              className="rounded-xl p-1.5 text-white/60 hover:text-white hover:bg-white/10 transition-colors flex-shrink-0"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

        </div>

        {/* ── Body: two columns ── */}
        <div className="flex flex-1 min-h-0 overflow-hidden divide-x divide-zinc-100">

          {/* ── LEFT: Brief details ── */}
          <div className="flex-1 overflow-y-auto p-7 space-y-5">

            {/* People */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">People</p>
              <TagUsersControl
                briefId={brief.id}
                clientId={brief.client_id}
                tagged={brief.tagged_users ?? []}
                tint={clientColor}
                onChange={onRefresh}
              />
            </div>

            {/* Description */}
            {brief.description && (
              <div>
                <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Description</p>
                <p className="text-sm text-zinc-700 whitespace-pre-wrap leading-relaxed bg-zinc-50 rounded-xl p-4 border border-zinc-100">
                  {brief.description}
                </p>
              </div>
            )}

            {/* Draft link */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Draft Link</p>
                {brief.draft_url?.includes('frame.io') && (
                  <span className="flex items-center gap-1 text-[10px] font-semibold rounded-full bg-indigo-50 text-indigo-600 px-2 py-0.5 border border-indigo-100">
                    <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-pulse" />
                    Frame.io
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
                  <input
                    type="url"
                    value={draftUrl}
                    onChange={e => setDraftUrl(e.target.value)}
                    onPaste={e => {
                      // Auto-save on paste — no need to click Save
                      const pasted = e.clipboardData.getData('text').trim()
                      if (pasted.startsWith('http')) {
                        setTimeout(() => saveDraftUrl(), 50)
                      }
                    }}
                    placeholder="Paste a Frame.io or Google Drive link…"
                    className="w-full rounded-xl border border-zinc-200 bg-zinc-50 pl-9 pr-3 py-2.5 text-sm text-zinc-700 focus:border-[#14C29F] focus:outline-none focus:ring-2 focus:ring-[#14C29F]/20"
                  />
                </div>
                <button
                  onClick={saveDraftUrl}
                  disabled={savingUrl || !draftUrl.trim()}
                  className="rounded-xl px-4 py-2.5 text-sm font-semibold text-white bg-zinc-900 hover:opacity-90 disabled:opacity-40 transition-opacity"
                >
                  {urlSaved ? '✓ Saved' : savingUrl ? '…' : 'Save'}
                </button>
              </div>
            </div>

            {/* Due date */}
            {brief.due_date && (
              <div>
                <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">Due</p>
                <p className="text-sm text-zinc-700">{format(new Date(brief.due_date), 'd MMMM yyyy')}</p>
              </div>
            )}

            {/* ── Internal actions ── */}
            {internalMode && (
              <div className="space-y-2 pt-1">

                {/* Revision alert */}
                {internalStatus === 'revisions_required' && hasClientFeedback && (
                  <div className="flex items-start gap-2 rounded-xl bg-red-50 border border-red-100 px-3 py-2.5">
                    <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-red-700">
                      {clientComments.length} piece{clientComments.length !== 1 ? 's' : ''} of client feedback — see comments
                    </p>
                  </div>
                )}

                {/* View draft + Push to client */}
                {brief.pipeline_status !== 'client_review' && brief.pipeline_status !== 'approved' && (
                  <div className="flex gap-2 pt-1">
                    <a
                      href={brief.draft_url ?? '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={e => { if (!brief.draft_url) e.preventDefault() }}
                      className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-white bg-blue-500 hover:opacity-90 transition-opacity ${!brief.draft_url ? 'opacity-30 pointer-events-none' : ''}`}
                    >
                      <ExternalLink className="h-4 w-4" />
                      View draft
                    </a>
                    <button
                      onClick={pushToClientReview}
                      disabled={!brief.draft_url}
                      className="flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-white bg-emerald-500 hover:opacity-90 disabled:opacity-30 transition-opacity"
                    >
                      Push to client
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                )}

                {/* Already with client */}
                {brief.pipeline_status === 'client_review' && internalStatus !== 'approved_by_client' && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 rounded-xl bg-blue-50 border border-blue-100 px-3 py-2.5">
                      <CheckCircle2 className="h-4 w-4 text-blue-500 flex-shrink-0" />
                      <p className="text-xs text-blue-700 font-medium">Sent to client — awaiting their feedback</p>
                    </div>
                    <button
                      onClick={markApprovedByClient}
                      className="w-full flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white bg-emerald-600 hover:opacity-90 transition-opacity"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Mark approved by client
                    </button>
                  </div>
                )}

                {/* Approved */}
                {brief.pipeline_status === 'approved' && (
                  <div className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-100 px-3 py-2.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                    <p className="text-xs text-emerald-700 font-medium">Approved by client ✓</p>
                  </div>
                )}

              </div>
            )}
          </div>

          {/* ── RIGHT: Comments ── */}
          <div className="w-72 flex flex-col flex-shrink-0 bg-white">

            {/* Comments header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 flex-shrink-0">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-3.5 w-3.5 text-zinc-400" />
                <span className="text-xs font-semibold text-zinc-600">
                  Comments {comments.length > 0 && `(${comments.length})`}
                </span>
              </div>
              {hasClientFeedback && (
                <span className="h-2 w-2 rounded-full bg-blue-500 flex-shrink-0" />
              )}
            </div>

            {/* Comment list */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">

              {/* Client feedback */}
              {clientComments.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5">
                    <MessageSquare className="h-3 w-3 text-blue-400" />
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-blue-500">Client Feedback</p>
                  </div>
                  {clientComments.map(c => (
                    <CommentBubble key={c.id} comment={c} variant="client" />
                  ))}
                </div>
              )}

              {/* Internal notes */}
              {internalComments.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5">
                    <Lock className="h-3 w-3 text-amber-500" />
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-600">Internal Notes</p>
                  </div>
                  {internalComments.map(c => (
                    <CommentBubble key={c.id} comment={c} variant="internal" />
                  ))}
                </div>
              )}

              {comments.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <MessageSquare className="h-7 w-7 text-zinc-200 mb-2" />
                  <p className="text-xs text-zinc-400 font-medium">No comments yet</p>
                  <p className="text-[11px] text-zinc-300 mt-0.5">Be the first to add a note</p>
                </div>
              )}

              <div ref={commentsEndRef} />
            </div>

            {/* Comment input */}
            <div className="border-t border-zinc-100 p-3 flex-shrink-0 space-y-2.5">

              {/* Internal / client visible toggle */}
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setIsInternal(false)}
                  className={`flex items-center gap-1.5 flex-1 justify-center rounded-lg px-2 py-1.5 text-[11px] font-semibold border transition-all ${
                    !isInternal ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-zinc-200 text-zinc-400 hover:border-zinc-300'
                  }`}
                >
                  <MessageSquare className="h-3 w-3" />
                  Client visible
                </button>
                <button
                  type="button"
                  onClick={() => setIsInternal(true)}
                  className={`flex items-center gap-1.5 flex-1 justify-center rounded-lg px-2 py-1.5 text-[11px] font-semibold border transition-all ${
                    isInternal ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-white border-zinc-200 text-zinc-400 hover:border-zinc-300'
                  }`}
                >
                  <Lock className="h-3 w-3" />
                  Internal only
                </button>
              </div>

              {/* Mention picker */}
              {mentionOpen && filteredMentions.length > 0 && (
                <div className="relative">
                  <div className="absolute bottom-full left-0 right-0 mb-1 bg-white border border-zinc-200 rounded-xl shadow-lg overflow-hidden z-10 max-h-36 overflow-y-auto">
                    {filteredMentions.map((u, idx) => (
                      <button
                        key={u.id}
                        type="button"
                        onMouseEnter={() => setMentionIndex(idx)}
                        onMouseDown={e => { e.preventDefault(); insertMention(u) }}
                        className={`flex items-center gap-2 w-full px-3 py-2 text-left transition-colors ${idx === mentionIndex ? 'bg-zinc-100' : 'hover:bg-zinc-50'}`}
                      >
                        <div
                          className="h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
                          style={{ backgroundColor: clientColor }}
                        >
                          {u.name.slice(0, 2).toUpperCase()}
                        </div>
                        <span className="text-sm font-medium text-zinc-700">{u.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Input + send */}
              <div className="flex items-end gap-2">
                <textarea
                  ref={textareaRef}
                  rows={2}
                  value={newComment}
                  onChange={e => handleCommentChange(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={isInternal ? 'Internal note…' : 'Write a comment… (@ to mention)'}
                  className={`flex-1 rounded-xl border px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 ${
                    isInternal
                      ? 'border-amber-200 bg-amber-50 focus:border-amber-400 focus:ring-amber-100 placeholder-amber-300'
                      : 'border-zinc-200 bg-zinc-50 focus:border-[#4950F8] focus:ring-[#4950F8]/20'
                  }`}
                />
                <button
                  onClick={sendComment}
                  disabled={sending || !newComment.trim()}
                  className="rounded-xl p-2.5 text-white disabled:opacity-40 transition-opacity flex-shrink-0"
                  style={{ backgroundColor: isInternal ? '#F59E0B' : '#14C29F' }}
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>

              {isInternal ? (
                <p className="text-[10px] text-amber-500 flex items-center gap-1">
                  <Lock className="h-2.5 w-2.5" /> Only the SwipeUp team can see this
                </p>
              ) : (
                <p className="text-[10px] text-zinc-400">⌘↵ to send</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Comment Bubble ───────────────────────────────────────────────────────────

function CommentBubble({ comment, variant }: { comment: Comment; variant: 'client' | 'internal' }) {
  const bg   = variant === 'client' ? 'bg-blue-50 border-blue-100' : 'bg-amber-50 border-amber-100'
  const name = comment.user_name ?? comment.user_email?.split('@')[0] ?? 'Unknown'

  // Single-word @handle match; trailing text stays default-coloured
  const parts = (comment.content ?? '').split(/(@[\w-]+)/g)

  return (
    <div className={`rounded-xl p-3 border ${bg}`}>
      <div className="flex items-center gap-2 mb-1.5">
        <div
          className="h-6 w-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0"
          style={{ backgroundColor: variant === 'client' ? '#3b82f6' : '#f59e0b' }}
        >
          {name.slice(0, 2).toUpperCase()}
        </div>
        <span className="text-[11px] font-semibold text-gray-800 flex-1">{name}</span>
        <span className="text-[10px] text-zinc-400 flex-shrink-0">
          {format(new Date(comment.created_at), 'd MMM · h:mm a')}
        </span>
      </div>
      <p className="text-xs leading-relaxed text-gray-700 pl-8">
        {parts.map((part, i) =>
          /^@[\w-]+$/.test(part)
            ? <span key={i} className="font-semibold" style={{ color: '#4950F8' }}>{part}</span>
            : <span key={i}>{part}</span>
        )}
      </p>
    </div>
  )
}
