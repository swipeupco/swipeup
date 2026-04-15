'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { X, ExternalLink, Send, Lock, MessageSquare, ChevronRight, Link as LinkIcon } from 'lucide-react'
import { format } from 'date-fns'

interface Brief {
  id: string
  name: string
  description: string | null
  campaign: string | null
  content_type: string | null
  pipeline_status: string
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
  onClose: () => void
  onMove: (id: string, stage: string) => void
  onRefresh: () => void
}

const STAGES = ['backlog', 'in_production', 'qa_review', 'client_review', 'approved']
const STAGE_LABELS: Record<string, string> = {
  backlog:       'Backlog',
  in_production: 'In Production',
  qa_review:     'QA Review',
  client_review: 'Client Review',
  approved:      'Approved',
}

export function BriefDrawer({ brief, clientColor, onClose, onMove, onRefresh }: Props) {
  const [comments, setComments]       = useState<Comment[]>([])
  const [newComment, setNewComment]   = useState('')
  const [isInternal, setIsInternal]   = useState(false)
  const [sending, setSending]         = useState(false)
  const [draftUrl, setDraftUrl]       = useState(brief.draft_url ?? '')
  const [savingUrl, setSavingUrl]     = useState(false)
  const [urlSaved, setUrlSaved]       = useState(false)
  const [tab, setTab]                 = useState<'brief' | 'comments'>('brief')
  const commentsEndRef = useRef<HTMLDivElement>(null)

  const currentIndex = STAGES.indexOf(brief.pipeline_status)
  const canAdvance   = currentIndex < STAGES.length - 1
  const nextStage    = canAdvance ? STAGES[currentIndex + 1] : null

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
    const supabase = createClient()
    await supabase.from('briefs').update({ draft_url: draftUrl.trim() }).eq('id', brief.id)
    setSavingUrl(false)
    setUrlSaved(true)
    onRefresh()
    setTimeout(() => setUrlSaved(false), 2000)
  }

  const clientComments   = comments.filter(c => !c.is_internal)
  const internalComments = comments.filter(c => c.is_internal)

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
                {brief.content_type && (
                  <span className="text-[10px] font-medium rounded-full px-2 py-0.5 bg-zinc-100 text-zinc-600">
                    {brief.content_type}
                  </span>
                )}
                <span
                  className="text-[10px] font-semibold rounded-full px-2 py-0.5 text-white"
                  style={{ backgroundColor: clientColor }}
                >
                  {STAGE_LABELS[brief.pipeline_status]}
                </span>
              </div>
            </div>
            <button onClick={onClose} className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 flex-shrink-0">
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Stage advance button */}
          {nextStage && (
            <button
              onClick={() => onMove(brief.id, nextStage)}
              className="mt-3 flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold text-white w-full justify-center transition-opacity hover:opacity-90"
              style={{ backgroundColor: clientColor }}
            >
              Move to {STAGE_LABELS[nextStage]}
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-zinc-100 flex-shrink-0">
          {(['brief', 'comments'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-3 text-xs font-semibold capitalize transition-colors ${
                tab === t
                  ? 'border-b-2 text-zinc-900'
                  : 'text-zinc-400 hover:text-zinc-600'
              }`}
              style={tab === t ? { borderColor: clientColor } : {}}
            >
              {t === 'comments' ? `Comments (${comments.length})` : 'Brief'}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">

          {tab === 'brief' && (
            <div className="p-6 space-y-5">

              {/* Brief description */}
              {brief.description && (
                <div>
                  <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">Brief</p>
                  <p className="text-sm text-zinc-700 whitespace-pre-wrap leading-relaxed bg-zinc-50 rounded-xl p-4 border border-zinc-100">
                    {brief.description}
                  </p>
                </div>
              )}

              {/* Draft URL */}
              <div>
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">Draft Link</p>
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
                    className="rounded-lg px-3 py-2 text-xs font-semibold text-white disabled:opacity-50 transition-all"
                    style={{ backgroundColor: clientColor }}
                  >
                    {urlSaved ? '✓ Saved' : savingUrl ? '…' : 'Save'}
                  </button>
                </div>
                {brief.draft_url && (
                  <a
                    href={brief.draft_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 flex items-center gap-1.5 text-xs font-medium hover:underline"
                    style={{ color: clientColor }}
                  >
                    <ExternalLink className="h-3 w-3" />
                    Open draft
                  </a>
                )}
              </div>

              {/* Due date */}
              {brief.due_date && (
                <div>
                  <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-1">Due</p>
                  <p className="text-sm text-zinc-700">{format(new Date(brief.due_date), 'd MMM yyyy')}</p>
                </div>
              )}
            </div>
          )}

          {tab === 'comments' && (
            <div className="flex flex-col h-full">
              <div className="flex-1 overflow-y-auto p-4 space-y-3">

                {/* Client comments */}
                {clientComments.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 py-1">
                      <MessageSquare className="h-3.5 w-3.5 text-blue-500" />
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-blue-500">Client Feedback</p>
                    </div>
                    {clientComments.map(c => (
                      <CommentBubble key={c.id} comment={c} internal={false} />
                    ))}
                  </div>
                )}

                {/* Internal notes */}
                {internalComments.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 py-1">
                      <Lock className="h-3.5 w-3.5 text-amber-500" />
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-600">Internal Notes</p>
                    </div>
                    {internalComments.map(c => (
                      <CommentBubble key={c.id} comment={c} internal={true} />
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
                {/* Internal toggle */}
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
                    placeholder={isInternal ? 'Internal note (not visible to client)…' : 'Leave a comment for the client…'}
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
                    style={{ backgroundColor: isInternal ? '#F59E0B' : clientColor }}
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </form>
                {isInternal && (
                  <p className="text-[10px] text-amber-500 mt-1.5 flex items-center gap-1">
                    <Lock className="h-3 w-3" /> Only SwipeUp team can see this
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

function CommentBubble({ comment, internal }: { comment: Comment; internal: boolean }) {
  return (
    <div className={`rounded-xl p-3 text-sm ${internal ? 'bg-amber-50 border border-amber-100' : 'bg-zinc-50 border border-zinc-100'}`}>
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className={`text-[11px] font-semibold ${internal ? 'text-amber-700' : 'text-zinc-700'}`}>
          {comment.user_name || comment.user_email?.split('@')[0] || 'Unknown'}
          {internal && <span className="ml-1 text-amber-400">(internal)</span>}
        </span>
        <span className="text-[10px] text-zinc-400">
          {format(new Date(comment.created_at), 'd MMM · h:mm a')}
        </span>
      </div>
      <p className={`text-xs leading-relaxed ${internal ? 'text-amber-800' : 'text-zinc-600'}`}>
        {comment.content}
      </p>
    </div>
  )
}
