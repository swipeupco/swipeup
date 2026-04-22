'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  X, Send, Lock, MessageSquare, Link as LinkIcon,
  CheckCircle2, AlertTriangle, Play,
} from 'lucide-react'
import { format } from 'date-fns'
import { CLIENT_STAGES, CLIENT_STAGE_LABELS, INTERNAL_STAGES, INTERNAL_STAGE_BADGES } from '@/lib/pipeline/stages'
import { updateBriefStatus } from '@/lib/pipeline/updateBriefStatus'

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

// Drawer is internal-only inside the Hub; client-facing usage keeps the same
// shape but hides the internal notes tab via the `internalMode` flag.
void CLIENT_STAGES

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
  const [commentsTab, setCommentsTab] = useState<'client' | 'internal'>('client')
  const [currentUserId, setCurrentUserId]   = useState<string | null>(null)
  const [currentUserName, setCurrentUserName]   = useState<string | null>(null)
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null)
  const commentsEndRef = useRef<HTMLDivElement>(null)
  const textareaRef    = useRef<HTMLTextAreaElement>(null)

  const internalStatus = brief.internal_status ?? 'in_production'
  const clientComments   = comments.filter(c => !c.is_internal)
  const internalComments = comments.filter(c => c.is_internal)
  const hasClientFeedback = clientComments.length > 0
  const visibleComments = commentsTab === 'client' ? clientComments : internalComments

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

  useEffect(() => {
    if (!brief.id) return
    loadComments()

    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setCurrentUserId(user.id)
        setCurrentUserEmail(user.email ?? null)
        supabase.from('profiles').select('name').eq('id', user.id).single()
          .then(({ data }) => setCurrentUserName(data?.name ?? null))
      }
    })

    const channel = supabase
      .channel(`comments-${brief.id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'brief_comments',
        filter: `brief_id=eq.${brief.id}`,
      }, () => loadComments())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brief.id])

  useEffect(() => {
    commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [comments, commentsTab])

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      sendComment()
    }
  }

  async function sendComment() {
    if (!newComment.trim()) return
    setSending(true)
    const supabase = createClient()
    await supabase.from('brief_comments').insert({
      brief_id:    brief.id,
      content:     newComment.trim(),
      user_id:     currentUserId,
      user_email:  currentUserEmail,
      user_name:   currentUserName ?? currentUserEmail?.split('@')[0] ?? 'Team',
      is_internal: isInternal,
    })
    setNewComment('')
    setSending(false)
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
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-2xl bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">

        {brief.cover_url && (
          <div className="flex-shrink-0 w-full bg-black/80 max-h-48 overflow-hidden rounded-t-2xl">
            <img src={brief.cover_url} alt="" className="w-full max-h-48 object-contain" />
          </div>
        )}

        {/* Client-coloured hero strip */}
        <div className="flex-shrink-0 px-6 py-4" style={{ backgroundColor: clientColor }}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              {brief.campaign && (
                <p className="text-xs font-medium mb-1 text-white/70">{brief.campaign}</p>
              )}
              <h2 className="font-bold text-white text-lg leading-snug">{brief.name}</h2>

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

        <div className="flex flex-1 min-h-0 overflow-hidden divide-x divide-[var(--border-muted)]">

          {/* Left pane: brief body + workflow actions */}
          <div className="flex-1 overflow-y-auto p-7 space-y-5">

            {brief.description && (
              <div>
                <p className="text-xs font-semibold text-[var(--text-dim)] uppercase tracking-wider mb-2">Description</p>
                <p className="text-sm text-[var(--text)] whitespace-pre-wrap leading-relaxed bg-[var(--surface-2)] rounded-xl p-4 border border-[var(--border)]">
                  {brief.description}
                </p>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-[var(--text-dim)] uppercase tracking-wider">Draft link</p>
                {brief.draft_url?.includes('frame.io') && (
                  <span className="flex items-center gap-1 text-[10px] font-semibold rounded-full bg-[var(--brand-soft)] text-[var(--brand)] px-2 py-0.5 border border-[var(--brand)]/30">
                    <span className="h-1.5 w-1.5 rounded-full bg-[var(--brand)] animate-pulse" />
                    Frame.io
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--text-dim)]" />
                  <input
                    type="url"
                    value={draftUrl}
                    onChange={e => setDraftUrl(e.target.value)}
                    onPaste={e => {
                      const pasted = e.clipboardData.getData('text').trim()
                      if (pasted.startsWith('http')) {
                        setTimeout(() => saveDraftUrl(), 50)
                      }
                    }}
                    placeholder="Paste a Frame.io or Google Drive link…"
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] pl-9 pr-3 py-2.5 text-sm text-[var(--text)] placeholder:text-[var(--text-dim)] focus:border-[var(--brand)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-ring)]"
                  />
                </div>
                <button
                  onClick={saveDraftUrl}
                  disabled={savingUrl || !draftUrl.trim()}
                  className="rounded-xl px-4 py-2.5 text-sm font-semibold text-white bg-[var(--brand)] hover:bg-[var(--brand-hover)] disabled:opacity-40 transition-colors"
                >
                  {urlSaved ? '✓ Saved' : savingUrl ? '…' : 'Save'}
                </button>
              </div>
            </div>

            {brief.due_date && (
              <div>
                <p className="text-xs font-semibold text-[var(--text-dim)] uppercase tracking-wider mb-1">Due</p>
                <p className="text-sm text-[var(--text)]">{format(new Date(brief.due_date), 'd MMMM yyyy')}</p>
              </div>
            )}

            {internalMode && (
              <div className="space-y-2 pt-1">

                {internalStatus === 'revisions_required' && hasClientFeedback && (
                  <div className="flex items-start gap-2 rounded-xl bg-red-500/10 border border-red-500/30 px-3 py-2.5">
                    <AlertTriangle className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-red-300">
                      {clientComments.length} piece{clientComments.length !== 1 ? 's' : ''} of client feedback — see comments
                    </p>
                  </div>
                )}

                {brief.pipeline_status !== 'client_review' && brief.pipeline_status !== 'approved' && (
                  <div className="flex gap-2 pt-1">
                    <a
                      href={brief.draft_url ?? '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={e => { if (!brief.draft_url) e.preventDefault() }}
                      className={`flex-1 flex items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] py-2.5 text-sm font-medium text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-3)] transition-colors ${!brief.draft_url ? 'opacity-30 pointer-events-none' : ''}`}
                    >
                      <Play className="h-4 w-4" />
                      View draft
                    </a>
                    <button
                      onClick={pushToClientReview}
                      disabled={!brief.draft_url}
                      className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-[var(--brand)] hover:bg-[var(--brand-hover)] py-2.5 text-sm font-semibold text-white disabled:opacity-30 transition-colors"
                    >
                      <Send className="h-4 w-4" />
                      Push to client
                    </button>
                  </div>
                )}

                {brief.pipeline_status === 'client_review' && internalStatus !== 'approved_by_client' && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 rounded-xl bg-[var(--brand-soft)] border border-[var(--brand)]/30 px-3 py-2.5">
                      <CheckCircle2 className="h-4 w-4 text-[var(--brand)] flex-shrink-0" />
                      <p className="text-xs text-[var(--brand)] font-medium">Sent to client — awaiting their feedback</p>
                    </div>
                    <button
                      onClick={markApprovedByClient}
                      className="w-full flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 transition-colors"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Mark approved by client
                    </button>
                  </div>
                )}

                {brief.pipeline_status === 'approved' && (
                  <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 px-3 py-2.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                    <p className="text-xs text-emerald-300 font-medium">Approved by client ✓</p>
                  </div>
                )}

              </div>
            )}
          </div>

          {/* Right pane: comments (with tabs for Client vs Internal when internalMode) */}
          <div className="w-72 flex flex-col flex-shrink-0 bg-[var(--surface)]">

            <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--border-muted)] flex-shrink-0">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                <span className="text-xs font-semibold text-[var(--text)]">
                  Comments {comments.length > 0 && `(${comments.length})`}
                </span>
              </div>
              {hasClientFeedback && commentsTab !== 'client' && (
                <span className="h-2 w-2 rounded-full bg-blue-400 flex-shrink-0" />
              )}
            </div>

            {internalMode && (
              <div className="flex gap-1 px-3 pt-2 flex-shrink-0">
                <button
                  onClick={() => setCommentsTab('client')}
                  className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-semibold border transition-colors ${
                    commentsTab === 'client'
                      ? 'bg-blue-500/10 border-blue-400/40 text-blue-400'
                      : 'bg-transparent border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)]'
                  }`}
                >
                  <MessageSquare className="h-3 w-3" />
                  Client ({clientComments.length})
                </button>
                <button
                  onClick={() => setCommentsTab('internal')}
                  className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-semibold border transition-colors ${
                    commentsTab === 'internal'
                      ? 'bg-amber-500/10 border-amber-400/40 text-amber-400'
                      : 'bg-transparent border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)]'
                  }`}
                >
                  <Lock className="h-3 w-3" />
                  Internal ({internalComments.length})
                </button>
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {visibleComments.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <MessageSquare className="h-7 w-7 text-[var(--text-dim)] mb-2" />
                  <p className="text-xs text-[var(--text-muted)] font-medium">No comments yet</p>
                  <p className="text-[11px] text-[var(--text-dim)] mt-0.5">
                    {commentsTab === 'internal' ? 'Drop an internal note' : 'Be the first to reply'}
                  </p>
                </div>
              ) : (
                visibleComments.map(c => (
                  <CommentBubble key={c.id} comment={c} variant={c.is_internal ? 'internal' : 'client'} />
                ))
              )}
              <div ref={commentsEndRef} />
            </div>

            <div className="border-t border-[var(--border-muted)] p-3 flex-shrink-0 space-y-2.5">

              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => { setIsInternal(false); setCommentsTab('client') }}
                  className={`flex items-center gap-1.5 flex-1 justify-center rounded-lg px-2 py-1.5 text-[11px] font-semibold border transition-colors ${
                    !isInternal ? 'bg-blue-500/10 border-blue-400/40 text-blue-400' : 'bg-[var(--surface-2)] border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)]'
                  }`}
                >
                  <MessageSquare className="h-3 w-3" />
                  Client visible
                </button>
                <button
                  type="button"
                  onClick={() => { setIsInternal(true); setCommentsTab('internal') }}
                  className={`flex items-center gap-1.5 flex-1 justify-center rounded-lg px-2 py-1.5 text-[11px] font-semibold border transition-colors ${
                    isInternal ? 'bg-amber-500/10 border-amber-400/40 text-amber-400' : 'bg-[var(--surface-2)] border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)]'
                  }`}
                >
                  <Lock className="h-3 w-3" />
                  Internal only
                </button>
              </div>

              <div className="flex items-end gap-2">
                <textarea
                  ref={textareaRef}
                  rows={2}
                  value={newComment}
                  onChange={e => setNewComment(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={isInternal ? 'Internal note…' : 'Write a comment…'}
                  className={`flex-1 rounded-xl border px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 text-[var(--text)] placeholder:text-[var(--text-dim)] ${
                    isInternal
                      ? 'border-amber-400/40 bg-amber-500/10 focus:border-amber-400 focus:ring-amber-400/20'
                      : 'border-[var(--border)] bg-[var(--surface-2)] focus:border-[var(--brand)] focus:ring-[var(--brand-ring)]'
                  }`}
                />
                <button
                  onClick={sendComment}
                  disabled={sending || !newComment.trim()}
                  className={`rounded-xl p-2.5 text-white disabled:opacity-40 transition-opacity flex-shrink-0 ${
                    isInternal ? 'bg-amber-500 hover:bg-amber-400' : 'bg-[var(--brand)] hover:bg-[var(--brand-hover)]'
                  }`}
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>

              {isInternal ? (
                <p className="text-[10px] text-amber-400 flex items-center gap-1">
                  <Lock className="h-2.5 w-2.5" /> Only the SwipeUp team can see this
                </p>
              ) : (
                <p className="text-[10px] text-[var(--text-dim)]">⌘↵ to send</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function CommentBubble({ comment, variant }: { comment: Comment; variant: 'client' | 'internal' }) {
  const bg      = variant === 'client' ? 'bg-blue-500/10 border-blue-400/30'   : 'bg-amber-500/10 border-amber-400/30'
  const nameCol = variant === 'client' ? 'text-blue-300'                        : 'text-amber-300'
  const textCol = variant === 'client' ? 'text-[var(--text)]'                  : 'text-[var(--text)]'
  const name    = comment.user_name ?? comment.user_email?.split('@')[0] ?? 'Unknown'

  return (
    <div className={`rounded-xl p-3 border ${bg}`}>
      <div className="flex items-center gap-2 mb-1.5">
        <div
          className="h-6 w-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0"
          style={{ backgroundColor: variant === 'client' ? '#3b82f6' : '#f59e0b' }}
        >
          {name.slice(0, 2).toUpperCase()}
        </div>
        <span className={`text-[11px] font-semibold ${nameCol} flex-1`}>{name}</span>
        <span className="text-[10px] text-[var(--text-dim)] flex-shrink-0">
          {format(new Date(comment.created_at), 'd MMM · h:mm a')}
        </span>
      </div>
      <p className={`text-xs leading-relaxed ${textCol} pl-8`}>{comment.content}</p>
    </div>
  )
}
