'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { X, ExternalLink, Send, Lock, MessageSquare, Link as LinkIcon, ArrowRight, CheckCircle2, AlertTriangle } from 'lucide-react'
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

export function BriefDrawer({ brief, clientColor, clientName, onClose, onMove, onInternalMove, onRefresh, onBriefUpdate, internalMode }: Props) {
  const [comments, setComments]       = useState<Comment[]>([])
  const [newComment, setNewComment]   = useState('')
  const [isInternal, setIsInternal]   = useState(internalMode ?? false) // default to internal in hub
  const [sending, setSending]         = useState(false)
  const [draftUrl, setDraftUrl]       = useState(brief.draft_url ?? '')
  const [savingUrl, setSavingUrl]     = useState(false)
  const [urlSaved, setUrlSaved]       = useState(false)
  const [tab, setTab]                 = useState<'brief' | 'comments'>('brief')
  const commentsEndRef = useRef<HTMLDivElement>(null)

  const internalStatus = brief.internal_status ?? 'in_production'
  const currentInternalIndex = INTERNAL_STAGES.findIndex(s => s.key === internalStatus)

  // Client pipeline advance (non-internal mode)
  const clientIndex = CLIENT_STAGE_KEYS.indexOf(brief.pipeline_status)
  const nextClientStage = clientIndex < CLIENT_STAGE_KEYS.length - 1 ? CLIENT_STAGE_KEYS[clientIndex + 1] : null

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
    loadComments()
    const supabase = createClient()
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
  }, [brief.id])

  useEffect(() => {
    commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [comments])

  async function sendComment(e: React.FormEvent) {
    e.preventDefault()
    if (!newComment.trim()) return
    setSending(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('brief_comments').insert({
      brief_id:    brief.id,
      content:     newComment.trim(),
      user_id:     user?.id,
      user_email:  user?.email,
      user_name:   user?.email?.split('@')[0] ?? 'Team',
      is_internal: isInternal,
    })
    setNewComment('')
    setSending(false)
    await loadComments()
  }

  async function saveDraftUrl() {
    if (!draftUrl.trim()) return
    setSavingUrl(true)
    // Saving a draft link automatically moves internal status to in_review
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
    // Atomically update both fields
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

  const clientComments   = comments.filter(c => !c.is_internal)
  const internalComments = comments.filter(c => c.is_internal)
  const hasClientFeedback = clientComments.length > 0

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className="relative w-full max-w-xl bg-white shadow-2xl flex flex-col h-full">

        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-100 flex-shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-zinc-400 mb-0.5">{brief.campaign ?? 'No campaign'}</p>
              <h2 className="font-semibold text-zinc-900 text-base leading-snug">{brief.name}</h2>

              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                {/* Client name badge (internal mode) */}
                {internalMode && clientName && (
                  <span
                    className="text-[10px] font-bold text-white rounded-full px-2 py-0.5"
                    style={{ backgroundColor: clientColor }}
                  >
                    {clientName}
                  </span>
                )}
                {brief.content_type && (
                  <span className="text-[10px] font-medium rounded-full px-2 py-0.5 bg-zinc-100 text-zinc-600">
                    {brief.content_type}
                  </span>
                )}
                {/* Internal status badge */}
                {internalMode && (
                  <span className={`text-[10px] font-semibold rounded-full px-2 py-0.5 ${INTERNAL_STAGE_BADGES[internalStatus]}`}>
                    {INTERNAL_STAGES.find(s => s.key === internalStatus)?.label}
                  </span>
                )}
                {/* Client pipeline status badge */}
                {internalMode && (
                  <span className="text-[10px] font-medium rounded-full px-2 py-0.5 bg-zinc-100 text-zinc-500">
                    Client: {CLIENT_STAGE_LABELS[brief.pipeline_status] ?? brief.pipeline_status}
                  </span>
                )}
                {!internalMode && (
                  <span
                    className="text-[10px] font-semibold rounded-full px-2 py-0.5 text-white"
                    style={{ backgroundColor: clientColor }}
                  >
                    {CLIENT_STAGE_LABELS[brief.pipeline_status]}
                  </span>
                )}
              </div>
            </div>
            <button onClick={onClose} className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 flex-shrink-0">
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* ── INTERNAL MODE CONTROLS ── */}
          {internalMode && (
            <div className="mt-3 space-y-2">

              {/* Stage stepper */}
              <div className="flex gap-1">
                {INTERNAL_STAGES.map((s, i) => (
                  <button
                    key={s.key}
                    onClick={() => onInternalMove?.(brief.id, s.key)}
                    title={s.label}
                    className={`flex-1 py-1.5 text-[9px] font-semibold rounded text-center transition-all ${
                      internalStatus === s.key
                        ? 'bg-zinc-900 text-white'
                        : i < currentInternalIndex
                        ? 'bg-zinc-200 text-zinc-500 hover:bg-zinc-300'
                        : 'bg-zinc-100 text-zinc-400 hover:bg-zinc-200'
                    }`}
                  >
                    {s.short}
                  </button>
                ))}
              </div>

              {/* Action buttons */}
              {internalStatus === 'in_review' && brief.pipeline_status !== 'client_review' && brief.pipeline_status !== 'approved' && (
                <button
                  onClick={pushToClientReview}
                  className="w-full flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:opacity-90 transition-opacity"
                >
                  Push to Client Review
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              )}

              {brief.pipeline_status === 'client_review' && internalStatus !== 'approved_by_client' && (
                <button
                  onClick={markApprovedByClient}
                  className="w-full flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold text-white bg-green-600 hover:opacity-90 transition-opacity"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Mark Approved by Client
                </button>
              )}

              {/* Revision alert */}
              {internalStatus === 'revisions_required' && hasClientFeedback && (
                <div className="flex items-start gap-2 rounded-xl bg-red-50 border border-red-100 px-3 py-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-red-700">
                    {clientComments.length} piece{clientComments.length !== 1 ? 's' : ''} of client feedback — check the Comments tab
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ── CLIENT PIPELINE MODE ── */}
          {!internalMode && nextClientStage && (
            <button
              onClick={() => onMove(brief.id, nextClientStage)}
              className="mt-3 flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold text-white w-full justify-center transition-opacity hover:opacity-90"
              style={{ backgroundColor: clientColor }}
            >
              Move to {CLIENT_STAGE_LABELS[nextClientStage]}
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-zinc-100 flex-shrink-0">
          {(['brief', 'comments'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-3 text-xs font-semibold capitalize transition-colors relative ${
                tab === t ? 'border-b-2 text-zinc-900' : 'text-zinc-400 hover:text-zinc-600'
              }`}
              style={tab === t ? { borderColor: internalMode ? '#18181b' : clientColor } : {}}
            >
              {t === 'comments'
                ? `Comments (${comments.length})`
                : 'Brief'
              }
              {t === 'comments' && hasClientFeedback && internalMode && tab !== 'comments' && (
                <span className="absolute top-2.5 right-4 h-2 w-2 rounded-full bg-blue-500" />
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">

          {/* ── BRIEF TAB ── */}
          {tab === 'brief' && (
            <div className="p-6 space-y-5">
              {brief.description && (
                <div>
                  <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">Brief</p>
                  <p className="text-sm text-zinc-700 whitespace-pre-wrap leading-relaxed bg-zinc-50 rounded-xl p-4 border border-zinc-100">
                    {brief.description}
                  </p>
                </div>
              )}

              {/* Draft / Review link */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">
                    {internalMode ? 'Draft Link' : 'Review Link'}
                  </p>
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
                      placeholder="https://app.frame.io/... or drive.google.com/..."
                      className="w-full rounded-lg border border-zinc-200 bg-zinc-50 pl-9 pr-3 py-2 text-sm text-zinc-700 focus:border-[#14C29F] focus:outline-none focus:ring-2 focus:ring-[#14C29F]/20"
                    />
                  </div>
                  <button
                    onClick={saveDraftUrl}
                    disabled={savingUrl || !draftUrl.trim()}
                    className="rounded-lg px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                    style={{ backgroundColor: internalMode ? '#18181b' : clientColor }}
                  >
                    {urlSaved ? '✓' : savingUrl ? '…' : 'Save'}
                  </button>
                </div>
                {brief.draft_url && (
                  <a
                    href={brief.draft_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 flex items-center gap-1.5 text-xs font-medium hover:underline"
                    style={{ color: internalMode ? '#14C29F' : clientColor }}
                  >
                    <ExternalLink className="h-3 w-3" />
                    {brief.draft_url.includes('frame.io') ? 'Open in Frame.io' : 'Open draft'}
                  </a>
                )}
                {internalMode && !brief.draft_url && (
                  <p className="mt-1.5 text-[10px] text-zinc-400">
                    Paste a Frame.io review link or any URL — or set up the webhook to auto-populate.
                  </p>
                )}
              </div>

              {brief.due_date && (
                <div>
                  <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-1">Due</p>
                  <p className="text-sm text-zinc-700">{format(new Date(brief.due_date), 'd MMM yyyy')}</p>
                </div>
              )}
            </div>
          )}

          {/* ── COMMENTS TAB ── */}
          {tab === 'comments' && (
            <div className="flex flex-col h-full">
              <div className="flex-1 overflow-y-auto p-4 space-y-4">

                {/* Client Feedback (non-internal) */}
                {clientComments.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 py-1">
                      <MessageSquare className="h-3.5 w-3.5 text-blue-500" />
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-blue-600">Client Feedback</p>
                    </div>
                    {clientComments.map(c => (
                      <CommentBubble key={c.id} comment={c} variant="client" />
                    ))}
                  </div>
                )}

                {/* Internal Notes */}
                {internalComments.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 py-1">
                      <Lock className="h-3.5 w-3.5 text-amber-500" />
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-600">Internal Notes</p>
                    </div>
                    {internalComments.map(c => (
                      <CommentBubble key={c.id} comment={c} variant="internal" />
                    ))}
                  </div>
                )}

                {comments.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <MessageSquare className="h-6 w-6 text-zinc-300 mb-2" />
                    <p className="text-xs text-zinc-400">No comments yet</p>
                  </div>
                )}

                <div ref={commentsEndRef} />
              </div>

              {/* Comment input */}
              <div className="border-t border-zinc-100 p-4 flex-shrink-0">
                <div className="flex items-center gap-2 mb-3">
                  <button
                    type="button"
                    onClick={() => setIsInternal(false)}
                    className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border transition-all ${
                      !isInternal ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-zinc-200 text-zinc-400'
                    }`}
                  >
                    <MessageSquare className="h-3 w-3" />
                    Client visible
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsInternal(true)}
                    className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border transition-all ${
                      isInternal ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-white border-zinc-200 text-zinc-400'
                    }`}
                  >
                    <Lock className="h-3 w-3" />
                    Internal only
                  </button>
                </div>

                <form onSubmit={sendComment} className="flex gap-2">
                  <input
                    type="text"
                    value={newComment}
                    onChange={e => setNewComment(e.target.value)}
                    placeholder={isInternal ? 'Internal note — not visible to client…' : 'Visible to client…'}
                    className={`flex-1 rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
                      isInternal
                        ? 'border-amber-200 bg-amber-50 focus:border-amber-400 focus:ring-amber-100 placeholder-amber-300'
                        : 'border-zinc-200 bg-zinc-50 focus:border-[#14C29F] focus:ring-[#14C29F]/20'
                    }`}
                  />
                  <button
                    type="submit"
                    disabled={sending || !newComment.trim()}
                    className="rounded-xl px-3 py-2 text-white disabled:opacity-50 transition-opacity"
                    style={{ backgroundColor: isInternal ? '#F59E0B' : (internalMode ? '#14C29F' : clientColor) }}
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </form>
                {isInternal && (
                  <p className="text-[10px] text-amber-500 mt-1.5 flex items-center gap-1">
                    <Lock className="h-3 w-3" /> Only the SwipeUp team can see this
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function CommentBubble({ comment, variant }: { comment: Comment; variant: 'client' | 'internal' }) {
  const styles = {
    client:   'bg-blue-50 border-blue-100',
    internal: 'bg-amber-50 border-amber-100',
  }
  const nameStyles = {
    client:   'text-blue-700',
    internal: 'text-amber-700',
  }
  const textStyles = {
    client:   'text-blue-800',
    internal: 'text-amber-800',
  }

  return (
    <div className={`rounded-xl p-3 text-sm border ${styles[variant]}`}>
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className={`text-[11px] font-semibold ${nameStyles[variant]}`}>
          {comment.user_name || comment.user_email?.split('@')[0] || 'Unknown'}
          {variant === 'internal' && <span className="ml-1 opacity-60">(internal)</span>}
        </span>
        <span className="text-[10px] text-zinc-400">
          {format(new Date(comment.created_at), 'd MMM · h:mm a')}
        </span>
      </div>
      <p className={`text-xs leading-relaxed ${textStyles[variant]}`}>{comment.content}</p>
    </div>
  )
}
