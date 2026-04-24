'use client'

/**
 * Portal-derived Creative Requests board primitives.
 *
 * The Hub's per-client pipeline (/pipeline/[clientSlug]) and master pipeline
 * (/pipeline) both surface briefs with the same visual language as the
 * client-facing Portal's /trello page. Rather than reinvent the card + drawer
 * look-and-feel, we copy the Portal's components verbatim (stripping away the
 * client-only AI flows) and parametrise the handful of spots where the Hub
 * needs to layer on internal overlays:
 *
 *   - BriefCard supports `showClientChip` so the master Pipeline can prepend
 *     a client-logo strip; on per-client boards it's off (client is implicit).
 *   - BriefCard shows the assigned-designer chip (Hub-only) on the bottom row.
 *   - BriefPanel supports `showInternalNotesTab` which toggles the comment
 *     thread between Client (is_internal=false) and Internal (is_internal=true).
 *   - BriefCard shows a "With client" blue pill when pipeline_status='client_review'.
 *
 * All Tailwind classNames, spacing, colour tokens, and layout are copied
 * straight from the Portal so the visual match holds.
 */

import { useEffect, useState, useRef } from 'react'
import {
  CheckCircle2, Play, X, Send, ExternalLink,
  MessageSquare, RotateCcw, Loader2, ChevronDown, Clock,
  Video, Image, Mail, LayoutGrid, Mic, FileText, CircleDot,
  GripVertical, Upload, Trash2, AtSign, Pencil, Check, Lock, User as UserIcon,
} from 'lucide-react'
import { DraggableProvidedDragHandleProps } from '@hello-pangea/dnd'
import { createClient } from '@/lib/supabase/client'
import { format } from 'date-fns'
import TagUsersControl from '@/components/briefs/TagUsersControl'
import BriefAttachments from '@/components/briefs/BriefAttachments'

// ═══════════════════════════════════════════════════════════════════════════
// Types + constants
// ═══════════════════════════════════════════════════════════════════════════

export interface Brief {
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
  sort_order?: number
  cover_url?: string | null
  sizes?: string[] | null
  ref_url?: string | null
  created_by?: string | null
  assigned_to?: string | null
  creator?: { id: string; name: string | null; avatar_url: string | null } | null
  tagged_users?: { id: string; name: string | null; avatar_url: string | null }[]
  // Hub-only additions:
  client_name?: string | null
  client_color?: string | null
  client_logo?: string | null
  assigned_designer?: { id: string; name: string | null; avatar_url: string | null } | null
}

export interface Comment {
  id: string
  content: string
  user_name: string | null
  user_email: string | null
  user_id: string | null
  is_internal: boolean
  created_at: string
}

interface MentionUser { id: string; name: string }

export const CONTENT_TYPES = [
  { id: 'Video',     icon: Video,      color: '#22c55e' },
  { id: 'Graphic',   icon: Image,      color: '#f97316' },
  { id: 'EDM',       icon: Mail,       color: '#ef4444' },
  { id: 'Signage',   icon: LayoutGrid, color: '#0ea5e9' },
  { id: 'Voiceover', icon: Mic,        color: '#a855f7' },
  { id: 'Script',    icon: FileText,   color: '#f59e0b' },
  { id: 'Other',     icon: CircleDot,  color: '#94a3b8' },
]

export const SIZES = ['1 x 1 Square', '4 x 5 Portrait', '9 x 16 Story/Reel', '16 x 9 Landscape']

function initialsOf(name: string | null | undefined) {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : parts[0].slice(0, 2).toUpperCase()
}

/** Spread this on any interactive element inside a BriefCard so pressing it
 *  doesn't start a drag. @hello-pangea/dnd installs its sensor on the drag
 *  handle's mousedown / touchstart / pointerdown — stopping propagation on
 *  each of those three blocks drag initiation in every browser while leaving
 *  the element's own onClick / href behaviour untouched. */
const STOP_DRAG = {
  onMouseDown:   (e: React.MouseEvent)   => { e.stopPropagation() },
  onTouchStart:  (e: React.TouchEvent)   => { e.stopPropagation() },
  onPointerDown: (e: React.PointerEvent) => { e.stopPropagation() },
}

// ═══════════════════════════════════════════════════════════════════════════
// Avatar primitives (copied from Portal)
// ═══════════════════════════════════════════════════════════════════════════

export function UserAvatar({
  user,
  size = 24,
  ring = false,
  tint = '#4950F8',
}: {
  user: { name: string | null; avatar_url: string | null } | null | undefined
  size?: number
  ring?: boolean
  tint?: string
}) {
  const title = user?.name ?? 'Unknown'
  return (
    <div
      title={title}
      className={`rounded-full flex items-center justify-center text-white font-bold overflow-hidden flex-shrink-0 ${ring ? 'ring-2 ring-white' : ''}`}
      style={{ width: size, height: size, fontSize: Math.max(9, size * 0.4), backgroundColor: tint }}
    >
      {user?.avatar_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={user.avatar_url} alt={title} className="h-full w-full object-cover" />
      ) : (
        initialsOf(user?.name)
      )}
    </div>
  )
}

export function StackedAvatars({
  users,
  max = 3,
  size = 22,
  tint = '#4950F8',
}: {
  users: { id: string; name: string | null; avatar_url: string | null }[]
  max?: number
  size?: number
  tint?: string
}) {
  const visible = users.slice(0, max)
  const extra   = users.length - visible.length
  return (
    <div className="flex items-center">
      {visible.map((u, i) => (
        <div key={u.id} className={i === 0 ? '' : '-ml-2'}>
          <UserAvatar user={u} size={size} ring tint={tint} />
        </div>
      ))}
      {extra > 0 && (
        <div
          className="-ml-2 rounded-full ring-2 ring-white bg-gray-100 text-[10px] font-bold text-gray-600 flex items-center justify-center"
          style={{ width: size, height: size }}
          title={`${extra} more`}
        >
          +{extra}
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// BriefCard
// ═══════════════════════════════════════════════════════════════════════════

export function BriefCard({
  brief, clientColor, reviewMode, isUpNext,
  dragHandleProps, isDragging,
  showClientChip,
  onOpen, onApprove, onRequestRevisions, onCoverUpload, onCoverDelete,
}: {
  brief: Brief
  clientColor: string
  reviewMode?: boolean
  isUpNext?: boolean
  dragHandleProps?: DraggableProvidedDragHandleProps | null
  isDragging?: boolean
  showClientChip?: boolean
  onOpen: () => void
  onApprove?: () => void
  onRequestRevisions?: () => void
  onCoverUpload?: (file: File | null) => void
  onCoverDelete?: () => void
}) {
  const [approving, setApproving]           = useState(false)
  const [revisioning, setRevisioning]       = useState(false)
  const [coverHover, setCoverHover]         = useState(false)
  const [coverMenuOpen, setCoverMenuOpen]   = useState(false)
  const [uploadingCover, setUploadingCover] = useState(false)
  const coverMenuRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!coverMenuOpen) return
    function handler(e: MouseEvent) {
      if (coverMenuRef.current && !coverMenuRef.current.contains(e.target as Node)) {
        setCoverMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [coverMenuOpen])

  const typeInfo    = CONTENT_TYPES.find(t => t.id === brief.content_type)
  const hasDraft    = !!brief.draft_url
  const isRevisions = brief.internal_status === 'revisions_required'
  const isWithClient = brief.pipeline_status === 'client_review'

  async function handleCoverChange(file: File | null) {
    if (!file || !onCoverUpload) return
    setUploadingCover(true)
    await onCoverUpload(file)
    setUploadingCover(false)
  }

  async function approve() {
    if (!onApprove) return
    setApproving(true)
    await onApprove()
    setApproving(false)
  }

  async function requestRevisions() {
    if (!onRequestRevisions) return
    setRevisioning(true)
    await onRequestRevisions()
    setRevisioning(false)
  }

  return (
    // The entire card surface is the drag handle — spread dragHandleProps
    // here so a press-and-hold anywhere on the card starts a drag. Clicks
    // without meaningful movement fall through to onClick and open the
    // drawer (@hello-pangea/dnd's click-vs-drag detection handles the
    // threshold automatically). Interactive children inside the card block
    // drag initiation via {...STOP_DRAG}.
    <div
      {...(dragHandleProps ?? {})}
      // Surface hierarchy (both modes, Trello "cards float" aesthetic):
      //   Light: canvas #F7F8FA → column bg-white → card bg-white + shadow-md
      //   Dark:  canvas #0B1220 → column #0F1420   → card #22283A
      // Light-mode lift comes from the shadow (card stays pure white); dark
      // lift comes from a lighter bg against the darker column/canvas.
      className={`relative overflow-hidden rounded-2xl bg-white dark:bg-[#22283A] p-4 transition-all ${isDragging
        ? 'rotate-1 scale-105 cursor-grabbing'
        // Sides + bottom border only — top dropped to avoid the blue-tinted
        // edge against the pipeline gradient in dark mode. Light-mode shadow
        // upgraded from shadow-sm to shadow-md for clearer elevation.
        : 'border-x border-b border-gray-100 dark:border-white/[0.08] shadow-md dark:shadow-none hover:shadow-lg dark:hover:border-white/[0.14] cursor-grab active:cursor-grabbing'
      }`}
      style={isDragging ? {
        boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
      } : {}}
      onClick={onOpen}
    >
      {/* Client colour stripe removed — the logo + name pill in the top row
          identifies the client on its own; the extra coloured edge was
          visual noise. Kept `relative overflow-hidden` for future use. */}
      {/* Hub-only: client logo + name at top (master pipeline only) */}
      {showClientChip && (brief.client_name || brief.client_color) && (
        <div className="flex items-center gap-1.5 mb-2 pb-2 border-b border-gray-50 dark:border-white/[0.06]">
          <div
            className="h-4 w-4 rounded flex items-center justify-center text-white text-[8px] font-bold flex-shrink-0 overflow-hidden"
            style={{ backgroundColor: brief.client_color ?? clientColor }}
          >
            {brief.client_logo
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={brief.client_logo} alt="" className="h-full w-full object-contain" />
              : (brief.client_name ?? '?').slice(0, 2).toUpperCase()
            }
          </div>
          <span className="text-[10px] font-semibold text-gray-500 dark:text-zinc-400 truncate">{brief.client_name ?? 'Client'}</span>
        </div>
      )}

      {/* Attribution + grip icon row (grip is now purely decorative —
          the whole card body is the drag handle) */}
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center">
          {brief.creator && (
            <UserAvatar user={brief.creator} size={24} tint={clientColor} />
          )}
          {(brief.tagged_users?.length ?? 0) > 0 && (
            <div className={brief.creator ? '-ml-2' : ''}>
              <StackedAvatars users={brief.tagged_users ?? []} tint={clientColor} size={22} />
            </div>
          )}
        </div>
        {dragHandleProps && (
          <div className="p-1 rounded-lg text-gray-200 dark:text-white/20" aria-hidden>
            <GripVertical className="h-4 w-4" />
          </div>
        )}
      </div>

      {/* Cover area — only rendered when an actual cover image is attached.
          No attachment means no placeholder block; the card compacts
          vertically. Cover uploads happen from the Files section in the
          drawer (BriefAttachments), not from the card. */}
      {brief.cover_url && (
        <div
          className="relative h-28 rounded-xl mb-3 overflow-hidden"
          onMouseEnter={() => setCoverHover(true)}
          onMouseLeave={() => setCoverHover(false)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={brief.cover_url} alt="" className="h-full w-full object-cover" />

          {brief.campaign && (
            <div className="absolute top-2 right-2 rounded-lg bg-black/60 backdrop-blur-sm px-2 py-1 max-w-[130px]">
              <p className="text-[10px] font-semibold text-white truncate">{brief.campaign}</p>
            </div>
          )}

          {onCoverUpload && (
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
              className="hidden"
              {...STOP_DRAG}
              onChange={e => {
                setCoverMenuOpen(false)
                const file = e.target.files?.[0] ?? null
                e.target.value = ''
                handleCoverChange(file)
              }}
            />
          )}

          {uploadingCover && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <Loader2 className="h-5 w-5 text-white animate-spin" />
            </div>
          )}

          {onCoverUpload && coverHover && !uploadingCover && (
            <div
              className="absolute bottom-2 right-2"
              ref={coverMenuRef}
              {...STOP_DRAG}
              onClick={e => e.stopPropagation()}
            >
              <button
                type="button"
                className="rounded-lg bg-black/70 px-2 py-1 flex items-center gap-1 hover:bg-black/85 transition-colors"
                onClick={() => setCoverMenuOpen(v => !v)}
              >
                <Upload className="h-3 w-3 text-white" />
                <span className="text-[10px] font-semibold text-white">Cover</span>
                <ChevronDown className="h-3 w-3 text-white" />
              </button>

              {coverMenuOpen && (
                <div className="absolute bottom-full mb-1 right-0 w-44 rounded-xl bg-white border border-zinc-200 shadow-xl overflow-hidden z-20">
                  <button
                    type="button"
                    className="flex items-center gap-2 w-full px-3 py-2 text-xs text-zinc-700 hover:bg-zinc-50 transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="h-3.5 w-3.5 text-zinc-400" />
                    Replace cover
                  </button>
                  {onCoverDelete && (
                    <button
                      type="button"
                      className="flex items-center gap-2 w-full px-3 py-2 text-xs text-red-500 hover:bg-red-50 transition-colors"
                      onClick={() => { setCoverMenuOpen(false); onCoverDelete() }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete cover
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Content type chip — brand colour outline, quiet fill (~8% on light,
          ~4% on dark) so it reads as an accent rather than a filled pill. */}
      {typeInfo && (
        <span
          className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold mb-2 border [background-color:var(--chip-bg-light)] dark:[background-color:var(--chip-bg-dark)]"
          style={{
            ['--chip-bg-light' as string]: `${typeInfo.color}14`,
            ['--chip-bg-dark'  as string]: `${typeInfo.color}0A`,
            color: typeInfo.color,
            borderColor: `${typeInfo.color}55`,
          } as React.CSSProperties}
        >
          {typeInfo.id}
        </span>
      )}

      {/* Title */}
      <p className="text-sm font-semibold text-gray-800 dark:text-slate-100 leading-snug">{brief.name}</p>

      {/* Status badges */}
      <div className="flex gap-1.5 flex-wrap mt-2 mb-3">
        {isRevisions && (
          <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold bg-red-50 dark:bg-red-500/15 text-red-500 dark:text-red-300 border border-red-100 dark:border-red-400/30">
            Revisions requested
          </span>
        )}
        {isWithClient && !isRevisions && (
          <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-300 border border-blue-100 dark:border-blue-400/30">
            With client
          </span>
        )}
        {!hasDraft && !reviewMode && (
          isUpNext ? (
            <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold bg-gray-50 dark:bg-white/5 text-gray-500 dark:text-zinc-300 border border-gray-200 dark:border-white/10">
              ⬆ Up next
            </span>
          ) : (
            <span className="rounded-full px-2 py-0.5 text-[10px] font-medium bg-gray-50 dark:bg-white/5 text-gray-400 dark:text-zinc-400 border border-gray-100 dark:border-white/10">
              Not started
            </span>
          )
        )}
        {!hasDraft && reviewMode && (
          <span className="rounded-full px-2 py-0.5 text-[10px] font-medium bg-gray-50 dark:bg-white/5 text-gray-400 dark:text-zinc-400 border border-gray-100 dark:border-white/10">
            Awaiting draft
          </span>
        )}
        {brief.due_date && (
          <span className="rounded-full px-2 py-0.5 text-[10px] font-medium bg-gray-50 dark:bg-white/5 text-gray-400 dark:text-zinc-400 border border-gray-100 dark:border-white/10">
            Due {format(new Date(brief.due_date), 'd MMM')}
          </span>
        )}
      </div>

      {/* Open Brief button — Hub brand violet (#4950F8) with ~8% lighter on
          hover. Deliberately NOT the client's brand colour — this is a Hub
          action, not a client-themed button. */}
      <button
        type="button"
        {...STOP_DRAG}
        onClick={e => { e.stopPropagation(); onOpen() }}
        className="mb-2 w-full flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold text-white cursor-pointer transition-colors bg-[#4950F8] hover:bg-[#5d64ff]"
      >
        <ExternalLink className="h-3 w-3" />
        Open Brief
      </button>

      {/* Action buttons */}
      <div className="flex gap-2" {...STOP_DRAG} onClick={e => e.stopPropagation()}>
        {hasDraft ? (
          <a
            href={brief.draft_url!}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 dark:border-white/10 py-2 text-xs font-semibold text-gray-600 dark:text-zinc-300 cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5 dark:hover:text-white transition-colors"
          >
            <Play className="h-3 w-3" />
            View Draft
          </a>
        ) : (
          <button
            type="button"
            disabled
            className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-gray-100 dark:border-white/[0.06] py-2 text-xs font-medium text-gray-300 dark:text-white/20 cursor-not-allowed"
          >
            <Play className="h-3 w-3" />
            View Draft
          </button>
        )}

        {onApprove && (
          <button
            type="button"
            onClick={approve}
            disabled={approving || !reviewMode || !hasDraft}
            className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold transition-colors ${
              reviewMode && hasDraft
                ? 'bg-emerald-500 text-white hover:bg-emerald-600 cursor-pointer'
                : 'bg-gray-50 dark:bg-white/[0.04] text-gray-300 dark:text-white/20 border border-gray-100 dark:border-white/[0.06] cursor-not-allowed'
            }`}
          >
            {approving ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
            Approve
          </button>
        )}
      </div>

      {reviewMode && hasDraft && !isRevisions && onRequestRevisions && (
        <button
          type="button"
          {...STOP_DRAG}
          onClick={e => { e.stopPropagation(); requestRevisions() }}
          disabled={revisioning}
          className="mt-2 w-full flex items-center justify-center gap-1.5 rounded-xl border border-red-100 dark:border-red-400/30 py-2 text-xs font-semibold text-red-500 dark:text-red-300 cursor-pointer hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
        >
          {revisioning ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
          Request Revisions
        </button>
      )}

      {/* Hub-only: assigned designer chip */}
      {brief.assigned_designer && (
        <div className="flex items-center gap-1.5 mt-2.5 pt-2.5 border-t border-gray-50 dark:border-white/[0.06]">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-zinc-400">Designer</span>
          <UserAvatar user={brief.assigned_designer} size={20} tint="#4950F8" />
          <span className="text-[11px] font-medium text-gray-600 dark:text-zinc-300 truncate">{brief.assigned_designer.name ?? '—'}</span>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// ApprovedBriefCard (copied verbatim from Portal)
// ═══════════════════════════════════════════════════════════════════════════

export function ApprovedBriefCard({ brief, showClientChip = false }: { brief: Brief; clientColor?: string; showClientChip?: boolean }) {
  const typeInfo = CONTENT_TYPES.find(t => t.id === brief.content_type)
  return (
    <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-[#22283A] border-x border-b border-gray-100 dark:border-white/[0.08] shadow-md dark:shadow-none p-4">
      {/* Client colour stripe removed — matches BriefCard, typography does
          the work of identifying the client via the logo + name pill. */}
      {showClientChip && brief.client_name && (
        <div className="flex items-center gap-1.5 mb-2 pb-2 border-b border-gray-50 dark:border-white/[0.06]">
          <div
            className="h-4 w-4 rounded flex items-center justify-center text-white text-[8px] font-bold flex-shrink-0 overflow-hidden"
            style={{ backgroundColor: brief.client_color ?? '#4950F8' }}
          >
            {brief.client_logo
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={brief.client_logo} alt="" className="h-full w-full object-contain" />
              : brief.client_name.slice(0, 2).toUpperCase()
            }
          </div>
          <span className="text-[10px] font-semibold text-gray-500 dark:text-zinc-400 truncate">{brief.client_name}</span>
        </div>
      )}
      <div className="flex items-start gap-3">
        <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0 text-emerald-500" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-800 dark:text-slate-100 leading-snug truncate">{brief.name}</p>
          {brief.campaign && <p className="text-xs text-gray-400 dark:text-zinc-500 mt-0.5">{brief.campaign}</p>}
          {typeInfo && (
            <span
              className="mt-2 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold [background-color:var(--chip-bg-light)] dark:[background-color:var(--chip-bg-dark)]"
              style={{
                ['--chip-bg-light' as string]: `${typeInfo.color}18`,
                ['--chip-bg-dark'  as string]: `${typeInfo.color}10`,
                color: typeInfo.color,
              } as React.CSSProperties}
            >
              {typeInfo.id}
            </span>
          )}
        </div>
        {brief.draft_url && (
          <a href={brief.draft_url} target="_blank" rel="noopener noreferrer"
            className="text-gray-300 dark:text-white/25 hover:text-gray-500 dark:hover:text-white/60 transition-colors flex-shrink-0 mt-0.5">
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// BriefPanel (ported from Portal; adds showInternalNotesTab + assigned_designer edit)
// ═══════════════════════════════════════════════════════════════════════════

export function BriefPanel({
  brief, clientColor,
  showInternalNotesTab, hubStaff, onAssignDesigner,
  onClose, onApprove, onRequestRevisions,
  onCoverUpload, onCoverDelete, onDelete, onReload,
}: {
  brief: Brief
  clientColor: string
  showInternalNotesTab?: boolean
  hubStaff?: Array<{ id: string; name: string | null; avatar_url: string | null }>
  onAssignDesigner?: (briefId: string, staffId: string | null) => Promise<void> | void
  onClose: () => void
  onApprove: () => void
  onRequestRevisions: () => void
  onCoverUpload?: (file: File) => void
  onCoverDelete?: () => void
  onDelete?: () => void
  onReload?: () => void
}) {
  const coverFileRef = useRef<HTMLInputElement>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [comments, setComments]             = useState<Comment[]>([])
  const [newComment, setNewComment]         = useState('')
  const [sending, setSending]               = useState(false)
  const [commentError, setCommentError]     = useState<string | null>(null)
  const [currentUserId, setCurrentUserId]   = useState<string | null>(null)
  const [hoveredCommentId, setHoveredCommentId] = useState<string | null>(null)
  const [editingId, setEditingId]           = useState<string | null>(null)
  const [editText, setEditText]             = useState('')
  const [savingEdit, setSavingEdit]         = useState(false)
  const [mentionUsers, setMentionUsers]     = useState<MentionUser[]>([])
  const [mentionOpen, setMentionOpen]       = useState(false)
  const [mentionQuery, setMentionQuery]     = useState('')
  const [mentionStart, setMentionStart]     = useState(0)
  const [mentionIndex, setMentionIndex]     = useState(0)
  const [pendingMentionIds, setPendingMentionIds] = useState<string[]>([])
  const [commentTab, setCommentTab]         = useState<'client' | 'internal'>('client')
  const [draftingInternal, setDraftingInternal] = useState(false)
  const [designerPickerOpen, setDesignerPickerOpen] = useState(false)
  const designerPickerRef = useRef<HTMLDivElement>(null)
  const endRef   = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const isReview   = ['in_production', 'client_review', 'qa_review'].includes(brief.pipeline_status)
  const isApproved = brief.pipeline_status === 'approved'
  const hasDraft   = !!brief.draft_url
  const typeInfo   = CONTENT_TYPES.find(t => t.id === brief.content_type)

  // Brief name isn't editable from this drawer, so no local state for it.
  const [localDesc, setLocalDesc]           = useState(brief.description ?? '')
  const [localCampaign, setLocalCampaign]   = useState(brief.campaign ?? '')
  const [localType, setLocalType]           = useState(brief.content_type ?? '')
  const [localSizes, setLocalSizes]         = useState<string[]>(brief.sizes ?? [])
  const [localRefUrl, setLocalRefUrl]       = useState(brief.ref_url ?? '')
  const [localDueDate, setLocalDueDate]     = useState(brief.due_date ?? '')
  const [localDraftUrl, setLocalDraftUrl]   = useState(brief.draft_url ?? '')
  const [editingField, setEditingField]     = useState<string | null>(null)
  const [savingField, setSavingField]       = useState<string | null>(null)

  useEffect(() => {
    if (editingField !== 'description')  setLocalDesc(brief.description ?? '')
    if (editingField !== 'campaign')     setLocalCampaign(brief.campaign ?? '')
    if (editingField !== 'content_type') setLocalType(brief.content_type ?? '')
    if (editingField !== 'sizes')        setLocalSizes(brief.sizes ?? [])
    if (editingField !== 'ref_url')      setLocalRefUrl(brief.ref_url ?? '')
    if (editingField !== 'due_date')     setLocalDueDate(brief.due_date ?? '')
    if (editingField !== 'draft_url')    setLocalDraftUrl(brief.draft_url ?? '')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brief])

  useEffect(() => {
    if (!designerPickerOpen) return
    function h(e: MouseEvent) {
      if (designerPickerRef.current && !designerPickerRef.current.contains(e.target as Node)) {
        setDesignerPickerOpen(false)
      }
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [designerPickerOpen])

  async function saveField(field: string, value: unknown) {
    setSavingField(field)
    const supabase = createClient()
    await supabase.from('briefs').update({ [field]: value || null }).eq('id', brief.id)
    setSavingField(null)
    setEditingField(null)
  }

  function toggleSize(s: string) {
    const next = localSizes.includes(s) ? localSizes.filter(x => x !== s) : [...localSizes, s]
    setLocalSizes(next)
    saveField('sizes', next.length ? next : null)
  }

  useEffect(() => {
    async function loadUsers() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) setCurrentUserId(user.id)

      const [clientRes, staffAccessRes] = await Promise.all([
        supabase.from('profiles').select('id, name').eq('client_id', brief.client_id),
        supabase.from('staff_client_access').select('staff_id').eq('client_id', brief.client_id),
      ])

      const staffIds = (staffAccessRes.data ?? []).map((r: { staff_id: string }) => r.staff_id)
      const staffProfiles = staffIds.length
        ? (await supabase.from('profiles').select('id, name').in('id', staffIds)).data ?? []
        : []

      const merged: Record<string, { id: string; name: string }> = {}
      ;[...(clientRes.data ?? []), ...staffProfiles].forEach((p) => {
        const typed = p as { id: string; name: string | null }
        if (typed.name) merged[typed.id] = { id: typed.id, name: typed.name }
      })

      setMentionUsers(Object.values(merged).sort((a, b) => a.name.localeCompare(b.name)))
    }
    loadUsers()
  }, [brief.client_id])

  async function loadComments() {
    const supabase = createClient()
    const query = supabase
      .from('brief_comments')
      .select('*')
      .eq('brief_id', brief.id)
      .order('created_at', { ascending: true })

    // Hub shows both streams via the tab; Portal hides internal comments.
    const { data } = showInternalNotesTab
      ? await query
      : await query.neq('is_internal', true)
    setComments((data as Comment[]) ?? [])
  }

  useEffect(() => {
    loadComments()
    const supabase = createClient()
    const channel = supabase
      .channel(`brief-comments-${brief.id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'brief_comments',
        filter: `brief_id=eq.${brief.id}`,
      }, () => loadComments())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brief.id, showInternalNotesTab])

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [comments, commentTab])

  function handleCommentChange(value: string) {
    setNewComment(value)
    const cursorPos = inputRef.current?.selectionStart ?? value.length
    const textBefore = value.slice(0, cursorPos)
    const atMatch = textBefore.match(/@(\w*)$/)
    if (atMatch) {
      setMentionQuery(atMatch[1])
      setMentionStart(cursorPos - atMatch[0].length)
      setMentionOpen(true)
    } else {
      setMentionOpen(false)
    }
  }

  function insertMention(user: MentionUser) {
    const before = newComment.slice(0, mentionStart)
    const after  = newComment.slice(mentionStart + mentionQuery.length + 1)
    const mention = `@${user.name} `
    setNewComment(before + mention + after)
    setMentionOpen(false)
    setMentionIndex(0)
    setPendingMentionIds(ids => Array.from(new Set([...ids, user.id])))
    setTimeout(() => inputRef.current?.focus(), 10)
  }

  async function handleDeleteComment(id: string) {
    const supabase = createClient()
    await supabase.from('brief_comments').delete().eq('id', id)
    await loadComments()
  }

  async function handleSaveEdit(id: string) {
    if (!editText.trim()) return
    setSavingEdit(true)
    const supabase = createClient()
    await supabase.from('brief_comments').update({ content: editText.trim() }).eq('id', id)
    setEditingId(null)
    setSavingEdit(false)
    await loadComments()
  }

  async function sendComment(e: React.FormEvent) {
    e.preventDefault()
    if (!newComment.trim() || sending) return
    setSending(true)
    setMentionOpen(false)
    const text = newComment.trim()
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const { data: profile }  = await supabase.from('profiles').select('name').eq('id', user!.id).single()
    const authorName = profile?.name ?? user?.email?.split('@')[0] ?? 'Someone'

    const { data: inserted, error } = await supabase.from('brief_comments').insert({
      brief_id:    brief.id,
      content:     text,
      user_id:     user?.id,
      user_email:  user?.email,
      user_name:   authorName,
      is_internal: draftingInternal,
    }).select('id').single()

    if (error) {
      setCommentError(
        error.code === '42P01'
          ? "The comments table doesn't exist yet — run the SQL setup in Supabase."
          : `Failed to send: ${error.message}`
      )
      setSending(false)
      return
    }

    const mentionIdsInText = pendingMentionIds.filter(uid => {
      const u = mentionUsers.find(m => m.id === uid)
      return u ? text.includes(`@${u.name}`) : false
    })
    if (inserted?.id && mentionIdsInText.length > 0) {
      const { error: mentionError } = await supabase.from('comment_mentions').insert(
        mentionIdsInText.map(uid => ({ comment_id: inserted.id, user_id: uid }))
      )
      if (mentionError) {
        setCommentError('Comment saved, but we could not tag everyone you mentioned.')
      }
    }

    setCommentError(null)
    setNewComment('')
    setPendingMentionIds([])
    setSending(false)
    await loadComments()
  }

  const filteredMentions = mentionUsers.filter(u =>
    u.name.toLowerCase().includes(mentionQuery.toLowerCase())
  )

  function getInitials(name: string | null) {
    if (!name) return '?'
    const parts = name.trim().split(' ')
    return parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : parts[0].slice(0, 2).toUpperCase()
  }

  function renderCommentContent(content: string) {
    const parts = content.split(/(@[\w-]+)/g)
    return parts.map((part, i) =>
      /^@[\w-]+$/.test(part)
        ? <span key={i} className="font-semibold" style={{ color: '#4950F8' }}>{part}</span>
        : <span key={i}>{part}</span>
    )
  }

  const visibleComments = showInternalNotesTab
    ? comments.filter(c => (commentTab === 'internal' ? c.is_internal : !c.is_internal))
    : comments

  const clientCount   = comments.filter(c => !c.is_internal).length
  const internalCount = comments.filter(c => c.is_internal).length

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col overflow-hidden" style={{ maxHeight: '90vh' }}>

        {brief.cover_url && (
          <div className="relative flex-shrink-0 w-full rounded-t-2xl group/coverpanel overflow-hidden bg-black/80">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={brief.cover_url} alt="" className="w-full max-h-48 object-contain" />
            {onCoverUpload && (
              <div className="absolute top-3 right-3 flex gap-2 opacity-0 group-hover/coverpanel:opacity-100 transition-opacity">
                <button
                  onClick={() => coverFileRef.current?.click()}
                  className="flex items-center gap-1.5 rounded-lg bg-black/60 hover:bg-black/80 px-2.5 py-1.5 text-[11px] font-semibold text-white transition-colors backdrop-blur-sm"
                >
                  <Upload className="h-3 w-3" /> Replace
                </button>
                {onCoverDelete && (
                  <button
                    onClick={onCoverDelete}
                    className="flex items-center gap-1.5 rounded-lg bg-black/60 hover:bg-red-600/80 px-2.5 py-1.5 text-[11px] font-semibold text-white transition-colors backdrop-blur-sm"
                  >
                    <Trash2 className="h-3 w-3" /> Remove
                  </button>
                )}
              </div>
            )}
            <input
              ref={coverFileRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={e => {
                const file = e.target.files?.[0]
                e.target.value = ''
                if (file && onCoverUpload) onCoverUpload(file)
              }}
            />
          </div>
        )}

        {/* Header bar — neutral chrome in both themes. Client-coloured bar
            removed; the compact client logo + name pill at the top preserves
            identification without colouring the drawer chrome. */}
        <div className="flex-shrink-0 px-6 py-4 flex items-start justify-between bg-gray-100 dark:bg-[#1E2435]">
          <div className="flex-1 min-w-0">
            {brief.client_name && (
              <div className="flex items-center gap-1.5 mb-3">
                <div
                  className="h-4 w-4 rounded flex items-center justify-center text-white text-[8px] font-bold flex-shrink-0 overflow-hidden"
                  style={{ backgroundColor: brief.client_color ?? clientColor }}
                >
                  {brief.client_logo
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={brief.client_logo} alt="" className="h-full w-full object-contain" />
                    : brief.client_name.slice(0, 2).toUpperCase()
                  }
                </div>
                <span className="text-[11px] font-semibold text-gray-600 dark:text-zinc-300 truncate">{brief.client_name}</span>
              </div>
            )}
            {brief.campaign && (
              <p className="text-xs font-medium mb-1 text-gray-500 dark:text-zinc-400">{brief.campaign}</p>
            )}
            <h2 className="text-xl font-bold text-gray-900 dark:text-white leading-snug">{brief.name}</h2>
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              {typeInfo && (
                <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold bg-gray-200 dark:bg-white/10 text-gray-700 dark:text-zinc-200">
                  <typeInfo.icon className="h-3 w-3" />
                  {typeInfo.id}
                </span>
              )}
              {isApproved && (
                <span className="rounded-full px-3 py-1 text-[11px] font-semibold bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">Approved ✓</span>
              )}
              {isReview && !isApproved && (
                <span className="rounded-full px-3 py-1 text-[11px] font-semibold bg-gray-200 dark:bg-white/10 text-gray-700 dark:text-zinc-200">In Production</span>
              )}
              {brief.due_date && (
                <span className="rounded-full px-3 py-1 text-[11px] font-medium bg-gray-200/70 dark:bg-white/5 text-gray-600 dark:text-zinc-300">
                  Due {format(new Date(brief.due_date), 'd MMM yyyy')}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close brief"
            className="ml-4 flex-shrink-0 rounded-xl p-2 text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-white/10 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden min-h-0">

          {/* LEFT: editable details */}
          <div className="w-[52%] flex-shrink-0 border-r border-gray-100 overflow-y-auto">
            <div className="p-6 space-y-6">

              {/* People (tagged users) */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">People</p>
                <TagUsersControl
                  briefId={brief.id}
                  clientId={brief.client_id}
                  tagged={brief.tagged_users ?? []}
                  tint={clientColor}
                  onChange={() => onReload?.()}
                />
              </div>

              {/* Hub-only: Assigned designer */}
              {showInternalNotesTab && hubStaff && onAssignDesigner && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Lock className="h-3 w-3" /> Assigned designer
                    <span className="font-normal text-gray-300 normal-case tracking-normal">— internal only</span>
                  </p>
                  <div className="relative" ref={designerPickerRef}>
                    <button
                      type="button"
                      onClick={() => setDesignerPickerOpen(v => !v)}
                      className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 hover:border-gray-300 transition-colors"
                    >
                      {brief.assigned_designer ? (
                        <>
                          <UserAvatar user={brief.assigned_designer} size={22} tint="#4950F8" />
                          <span className="font-medium">{brief.assigned_designer.name ?? '—'}</span>
                        </>
                      ) : (
                        <>
                          <div className="h-[22px] w-[22px] rounded-full bg-gray-200 flex items-center justify-center">
                            <UserIcon className="h-3 w-3 text-gray-500" />
                          </div>
                          <span className="text-gray-500">Assign a designer…</span>
                        </>
                      )}
                      <ChevronDown className="h-3.5 w-3.5 text-gray-400 ml-1" />
                    </button>
                    {designerPickerOpen && (
                      <div className="absolute left-0 top-full mt-1 w-64 rounded-xl bg-white border border-gray-200 shadow-lg z-20 overflow-hidden">
                        <div className="max-h-60 overflow-y-auto">
                          {hubStaff.map(s => (
                            <button
                              key={s.id}
                              type="button"
                              onClick={async () => { await onAssignDesigner(brief.id, s.id); setDesignerPickerOpen(false) }}
                              className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-gray-50 transition-colors text-sm"
                            >
                              <UserAvatar user={s} size={22} tint="#4950F8" />
                              <span className="flex-1 truncate text-gray-700">{s.name ?? 'Unknown'}</span>
                              {brief.assigned_designer?.id === s.id && <Check className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />}
                            </button>
                          ))}
                          {hubStaff.length === 0 && (
                            <p className="px-3 py-3 text-xs text-gray-400">No Hub staff available.</p>
                          )}
                        </div>
                        {brief.assigned_designer && (
                          <button
                            type="button"
                            onClick={async () => { await onAssignDesigner(brief.id, null); setDesignerPickerOpen(false) }}
                            className="flex items-center gap-2 w-full px-3 py-2 text-left text-xs text-red-500 hover:bg-red-50 transition-colors border-t border-gray-100"
                          >
                            <X className="h-3 w-3" /> Unassign
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Draft / action buttons */}
              <div className="space-y-2">
                {hasDraft ? (
                  <a
                    href={brief.draft_url!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white w-full hover:opacity-90 transition-opacity shadow-sm"
                    style={{ backgroundColor: clientColor }}
                  >
                    <ExternalLink className="h-4 w-4" />
                    View Draft
                  </a>
                ) : (
                  <div className="space-y-1.5">
                    {isReview && (
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Current Status</p>
                    )}
                    <div
                      className="flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium bg-gray-50 border border-dashed w-full"
                      style={isReview
                        ? { borderColor: `${clientColor}60`, color: clientColor }
                        : { borderColor: '#e5e7eb', color: '#9ca3af' }}
                    >
                      {isReview ? (
                        <>
                          <span className="relative flex h-2 w-2 flex-shrink-0">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: clientColor }} />
                            <span className="relative inline-flex rounded-full h-2 w-2" style={{ backgroundColor: clientColor }} />
                          </span>
                          <span>We&apos;re working on it right now</span>
                        </>
                      ) : (
                        <>
                          <Clock className="h-4 w-4" />
                          Not started yet
                        </>
                      )}
                    </div>
                  </div>
                )}
                {/* Hub-only: paste a draft URL inline */}
                {showInternalNotesTab && (
                  <div className="pt-1">
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 block mb-1.5">Draft link</label>
                    <div className="flex gap-2">
                      <input
                        type="url"
                        value={localDraftUrl}
                        onChange={e => setLocalDraftUrl(e.target.value)}
                        onFocus={() => setEditingField('draft_url')}
                        onBlur={() => {
                          if (editingField === 'draft_url') {
                            saveField('draft_url', localDraftUrl.trim() || null)
                          }
                        }}
                        placeholder="Paste a Frame.io, Drive, Figma link…"
                        className="flex-1 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:border-transparent transition-all hover:border-gray-300"
                        style={{ '--tw-ring-color': clientColor } as React.CSSProperties}
                      />
                      {savingField === 'draft_url' && <Loader2 className="h-4 w-4 animate-spin text-gray-400 self-center" />}
                    </div>
                  </div>
                )}
                {isReview && hasDraft && !isApproved && (
                  <div className="flex gap-2">
                    <button onClick={onRequestRevisions}
                      className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-red-100 py-2.5 text-xs font-semibold text-red-500 hover:bg-red-50 transition-colors">
                      <RotateCcw className="h-3.5 w-3.5" /> Request Revisions
                    </button>
                    <button onClick={onApprove}
                      className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-semibold text-white bg-emerald-500 hover:bg-emerald-600 transition-colors">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                    </button>
                  </div>
                )}
              </div>

              <div>
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Description</p>
                <textarea
                  rows={6}
                  value={localDesc}
                  onChange={e => setLocalDesc(e.target.value)}
                  onFocus={() => setEditingField('description')}
                  onBlur={() => { if (editingField === 'description') saveField('description', localDesc) }}
                  placeholder="Add a more detailed description…"
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:border-transparent transition-all resize-none hover:border-gray-300"
                  style={{ '--tw-ring-color': clientColor } as React.CSSProperties}
                />
                {savingField === 'description' && (
                  <p className="text-[10px] text-gray-400 mt-1 flex items-center gap-1"><Loader2 className="h-2.5 w-2.5 animate-spin" /> Saving…</p>
                )}
              </div>

              <div>
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Details</p>
                <div className="space-y-3">
                  <div className="grid grid-cols-[120px_1fr] items-center gap-3">
                    <span className="text-xs font-medium text-gray-500">Campaign</span>
                    <input
                      type="text"
                      value={localCampaign}
                      onChange={e => setLocalCampaign(e.target.value)}
                      onFocus={() => setEditingField('campaign')}
                      onBlur={() => { if (editingField === 'campaign') saveField('campaign', localCampaign) }}
                      placeholder="Add campaign name…"
                      className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:border-transparent hover:border-gray-300 transition-all w-full"
                      style={{ '--tw-ring-color': clientColor } as React.CSSProperties}
                    />
                  </div>
                  <div className="grid grid-cols-[120px_1fr] items-center gap-3">
                    <span className="text-xs font-medium text-gray-500">Due Date</span>
                    <input
                      type="date"
                      value={localDueDate}
                      onChange={e => { setLocalDueDate(e.target.value); saveField('due_date', e.target.value) }}
                      className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:border-transparent hover:border-gray-300 transition-all w-full"
                      style={{ '--tw-ring-color': clientColor } as React.CSSProperties}
                    />
                  </div>
                  <div className="grid grid-cols-[120px_1fr] items-center gap-3">
                    <span className="text-xs font-medium text-gray-500">Inspiration</span>
                    <input
                      type="url"
                      value={localRefUrl}
                      onChange={e => setLocalRefUrl(e.target.value)}
                      onFocus={() => setEditingField('ref_url')}
                      onBlur={() => { if (editingField === 'ref_url') saveField('ref_url', localRefUrl) }}
                      placeholder="https://…"
                      className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:border-transparent hover:border-gray-300 transition-all w-full"
                      style={{ '--tw-ring-color': clientColor } as React.CSSProperties}
                    />
                  </div>
                </div>
              </div>

              <div>
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Content Type</p>
                <div className="flex flex-wrap gap-2">
                  {CONTENT_TYPES.map(t => {
                    const active = localType === t.id
                    return (
                      <button
                        key={t.id}
                        onClick={() => { setLocalType(t.id); saveField('content_type', t.id) }}
                        className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold border transition-all"
                        style={active
                          ? { backgroundColor: t.color, color: '#fff', borderColor: t.color }
                          : { backgroundColor: `${t.color}12`, color: t.color, borderColor: `${t.color}30` }
                        }
                      >
                        <t.icon className="h-3.5 w-3.5" />
                        {t.id}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Aspect Ratios</p>
                <div className="flex flex-wrap gap-2">
                  {SIZES.map(s => {
                    const active = localSizes.includes(s)
                    return (
                      <button
                        key={s}
                        onClick={() => toggleSize(s)}
                        className="rounded-xl px-3 py-2 text-xs font-semibold border transition-all"
                        style={active
                          ? { backgroundColor: clientColor, color: '#fff', borderColor: clientColor }
                          : { backgroundColor: '#f9fafb', color: '#6b7280', borderColor: '#e5e7eb' }
                        }
                      >
                        {s}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Files — uploads, previews, cover selection. The first
                  upload auto-marks as cover; later clicks on the star
                  flip it. Cover attachment dual-writes briefs.cover_url
                  so BriefCard's existing cover_url path works across the
                  Hub and the Portal. */}
              <BriefAttachments briefId={brief.id} clientColor={clientColor} />

              {onDelete && (
                <div className="pt-2 border-t border-gray-100">
                  {!confirmDelete ? (
                    <button
                      onClick={() => setConfirmDelete(true)}
                      className="flex items-center gap-1.5 text-xs font-medium text-gray-300 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete brief
                    </button>
                  ) : (
                    <div className="rounded-xl border border-red-100 bg-red-50 p-3 space-y-2">
                      <p className="text-xs font-semibold text-red-600">Delete this brief?</p>
                      <p className="text-[11px] text-red-400">This cannot be undone. All comments and files will be permanently removed.</p>
                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={() => setConfirmDelete(false)}
                          className="flex-1 rounded-lg border border-gray-200 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-50 transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          disabled={deleting}
                          onClick={async () => { setDeleting(true); await onDelete() }}
                          className="flex-1 rounded-lg bg-red-500 hover:bg-red-600 py-1.5 text-xs font-semibold text-white transition-colors flex items-center justify-center gap-1.5 disabled:opacity-60"
                        >
                          {deleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                          Yes, delete
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: Comments */}
          <div className="flex-1 flex flex-col overflow-hidden min-w-0">
            <div className="px-6 py-4 border-b border-gray-100 flex-shrink-0">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-gray-800">
                  Comments {comments.length > 0 && <span className="text-gray-400 font-normal">({comments.length})</span>}
                </p>
                {showInternalNotesTab && (
                  <div className="flex gap-1 p-1 rounded-xl bg-gray-100 border border-gray-200">
                    <button
                      onClick={() => { setCommentTab('client'); setDraftingInternal(false) }}
                      className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                        commentTab === 'client' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      <MessageSquare className="h-3 w-3" />
                      Client ({clientCount})
                    </button>
                    <button
                      onClick={() => { setCommentTab('internal'); setDraftingInternal(true) }}
                      className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                        commentTab === 'internal' ? 'bg-white text-amber-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      <Lock className="h-3 w-3" />
                      Internal ({internalCount})
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
              {visibleComments.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <MessageSquare className="h-8 w-8 text-gray-200 mb-2" />
                  <p className="text-sm text-gray-400 font-medium">No comments yet</p>
                  <p className="text-xs text-gray-300 mt-1">
                    {showInternalNotesTab && commentTab === 'internal' ? 'Drop an internal note below' : 'Leave feedback or ask a question below'}
                  </p>
                </div>
              )}
              {visibleComments.map(c => {
                const isOwn     = c.user_id === currentUserId
                const isHovered = hoveredCommentId === c.id
                const isEditing = editingId === c.id
                const internalTint = c.is_internal
                return (
                  <div
                    key={c.id}
                    className="flex gap-3"
                    onMouseEnter={() => setHoveredCommentId(c.id)}
                    onMouseLeave={() => setHoveredCommentId(null)}
                  >
                    <div
                      className="h-8 w-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0 mt-0.5"
                      style={{ backgroundColor: internalTint ? '#f59e0b' : clientColor }}
                    >
                      {getInitials(c.user_name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-sm font-semibold text-gray-800">{c.user_name || 'Team'}</span>
                        {internalTint && (
                          <span className="rounded-full px-1.5 py-0.5 text-[9px] font-bold bg-amber-100 text-amber-700">
                            Internal
                          </span>
                        )}
                        <span className="text-xs text-gray-400">{format(new Date(c.created_at), 'd MMM · h:mm a')}</span>
                        {isOwn && isHovered && !isEditing && (
                          <div className="ml-auto flex items-center gap-0.5">
                            <button
                              onClick={() => { setEditingId(c.id); setEditText(c.content ?? '') }}
                              className="p-1.5 rounded-lg text-gray-300 hover:text-blue-500 hover:bg-blue-50 transition-colors"
                              title="Edit"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteComment(c.id)}
                              className="p-1.5 rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                      {isEditing ? (
                        <div>
                          <textarea
                            autoFocus
                            rows={2}
                            value={editText}
                            onChange={e => setEditText(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSaveEdit(c.id) }
                              if (e.key === 'Escape') setEditingId(null)
                            }}
                            className="w-full rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none"
                          />
                          <div className="flex items-center gap-2 mt-1.5">
                            <button
                              onClick={() => handleSaveEdit(c.id)}
                              disabled={savingEdit}
                              className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90"
                              style={{ backgroundColor: clientColor }}
                            >
                              {savingEdit ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                              Save
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="rounded-lg px-3 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-100 transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className={`rounded-2xl rounded-tl-sm px-4 py-3 border ${
                          internalTint ? 'bg-amber-50 border-amber-100' : 'bg-gray-50 border-gray-100'
                        }`}>
                          <p className="text-sm text-gray-700 leading-relaxed">
                            {renderCommentContent(c.content ?? '')}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
              <div ref={endRef} />
            </div>

            <div className="border-t border-gray-100 p-4 flex-shrink-0 relative">
              {mentionOpen && filteredMentions.length > 0 && (
                <div className="absolute bottom-full left-4 right-4 mb-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden z-10 max-h-36 overflow-y-auto">
                  {filteredMentions.map((u, idx) => (
                    <button
                      key={u.id}
                      type="button"
                      onMouseEnter={() => setMentionIndex(idx)}
                      onMouseDown={e => { e.preventDefault(); insertMention(u) }}
                      className={`flex items-center gap-2.5 w-full px-3 py-2.5 text-left transition-colors ${idx === mentionIndex ? 'bg-gray-100' : 'hover:bg-gray-50'}`}
                    >
                      <div
                        className="h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
                        style={{ backgroundColor: clientColor }}
                      >
                        {getInitials(u.name)}
                      </div>
                      <span className="text-sm font-medium text-gray-700">{u.name}</span>
                    </button>
                  ))}
                </div>
              )}
              <form onSubmit={sendComment} className="flex gap-2 items-end">
                <div className="flex-1">
                  <textarea
                    ref={inputRef}
                    rows={2}
                    value={newComment}
                    onChange={e => handleCommentChange(e.target.value)}
                    onKeyDown={e => {
                      if (mentionOpen && filteredMentions.length > 0) {
                        if (e.key === 'ArrowDown') {
                          e.preventDefault()
                          setMentionIndex(i => Math.min(i + 1, filteredMentions.length - 1))
                          return
                        }
                        if (e.key === 'ArrowUp') {
                          e.preventDefault()
                          setMentionIndex(i => Math.max(i - 1, 0))
                          return
                        }
                        if (e.key === 'Enter' || e.key === 'Tab') {
                          e.preventDefault()
                          const pick = filteredMentions[mentionIndex] ?? filteredMentions[0]
                          if (pick) insertMention(pick)
                          return
                        }
                        if (e.key === 'Escape') { e.preventDefault(); setMentionOpen(false); return }
                      }
                      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendComment(e as unknown as React.FormEvent) }
                      if (e.key === 'Escape') setMentionOpen(false)
                    }}
                    placeholder={draftingInternal ? 'Internal note… (@ to mention teammates)' : 'Write a comment… (@ to mention)'}
                    className={`w-full rounded-xl border px-4 py-3 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:border-transparent transition-all resize-none ${
                      draftingInternal
                        ? 'border-amber-200 bg-amber-50 focus:ring-amber-300'
                        : 'border-gray-200 bg-gray-50'
                    }`}
                  />
                </div>
                <button
                  type="submit"
                  disabled={sending || !newComment.trim()}
                  className="rounded-xl px-3 py-3 text-white disabled:opacity-40 shadow-sm transition-opacity hover:opacity-90 flex-shrink-0"
                  style={{ backgroundColor: draftingInternal ? '#f59e0b' : clientColor }}
                >
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </button>
              </form>
              {commentError ? (
                <p className="text-xs text-red-500 mt-1.5 pl-1 font-medium">{commentError}</p>
              ) : (
                <p className="text-[10px] text-gray-400 mt-1.5 pl-1">
                  {draftingInternal ? (
                    <><Lock className="inline h-2.5 w-2.5" /> Internal — only the Hub team can see this</>
                  ) : (
                    <><AtSign className="inline h-2.5 w-2.5" /> to mention · Enter to send · Shift+Enter for new line</>
                  )}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// CreateBriefModal (Hub-adapted — no AI generator, same layout as Portal)
// ═══════════════════════════════════════════════════════════════════════════

export function CreateBriefModal({
  clientId, clientColor, onClose, onCreated,
}: {
  clientId: string
  clientColor: string
  onClose: () => void
  onCreated: () => void
}) {
  const [name, setName]               = useState('')
  const [description, setDesc]        = useState('')
  const [campaign, setCampaign]       = useState('')
  const [contentType, setContentType] = useState('')
  const [sizes, setSizes]             = useState<string[]>([])
  const [refUrls, setRefUrls]         = useState<string[]>([''])
  const [dueDate, setDueDate]         = useState('')
  const [saving, setSaving]           = useState(false)

  function toggleSize(s: string) {
    setSizes(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const { data: inProd } = await supabase
      .from('briefs')
      .select('id')
      .eq('client_id', clientId)
      .in('pipeline_status', ['in_production','client_review','qa_review'])
    const productionEmpty = (inProd?.length ?? 0) === 0

    // Hub auto-assigns if staff_default_assignments has a row for this client
    let assignedTo: string | null = null
    try {
      const { data: defaults } = await supabase
        .from('staff_default_assignments')
        .select('staff_id')
        .eq('client_id', clientId)
        .order('created_at', { ascending: true })
        .limit(1)
      assignedTo = (defaults?.[0] as { staff_id: string } | undefined)?.staff_id ?? null
    } catch { /* table not yet deployed */ }

    const refUrl = (refUrls ?? []).find(u => u.trim()) ?? null
    await supabase.from('briefs').insert({
      name:            name.trim(),
      description:     description.trim() || null,
      campaign:        campaign.trim() || null,
      content_type:    contentType || null,
      sizes:           sizes.length ? sizes : null,
      ref_url:         refUrl,
      due_date:        dueDate || null,
      client_id:       clientId,
      pipeline_status: productionEmpty ? 'in_production' : 'backlog',
      internal_status: productionEmpty ? 'in_production' : 'backlog',
      sort_order:      productionEmpty ? 0 : 9999,
      created_by:      user?.id ?? null,
      assigned_to:     assignedTo,
    })
    setSaving(false)
    onCreated()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900">Create Brief</h2>
          <button onClick={onClose} className="rounded-xl p-2 text-gray-400 hover:bg-gray-100 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="px-6 py-5 space-y-5">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1.5">Title *</label>
                <input
                  type="text" value={name} onChange={e => setName(e.target.value)}
                  required placeholder="e.g. Summer Sale – Instagram Reel"
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 transition-all"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1.5">Campaign / Show</label>
                <input
                  type="text" value={campaign} onChange={e => setCampaign(e.target.value)}
                  placeholder="e.g. Summer Campaign 2026"
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 transition-all"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1.5">Brief <span className="font-normal text-gray-400">— keep it short</span></label>
              <textarea
                value={description} onChange={e => setDesc(e.target.value)}
                rows={4} placeholder="Objective | Key Message | Tone"
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 transition-all resize-none"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-2">Content Type</label>
              <div className="flex gap-2 flex-wrap">
                {CONTENT_TYPES.map(t => {
                  const Icon = t.icon
                  return (
                    <button
                      key={t.id} type="button"
                      onClick={() => setContentType(contentType === t.id ? '' : t.id)}
                      className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold border transition-all"
                      style={contentType === t.id
                        ? { backgroundColor: t.color, color: '#fff', borderColor: t.color }
                        : { backgroundColor: 'transparent', color: '#6b7280', borderColor: '#e5e7eb' }
                      }
                    >
                      <Icon className="h-3 w-3" />
                      {t.id}
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1.5">Due Date</label>
                <input
                  type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 transition-all"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-2">Sizes</label>
                <div className="flex gap-1 flex-wrap">
                  {SIZES.map(s => (
                    <button
                      key={s} type="button"
                      onClick={() => toggleSize(s)}
                      className="rounded-full px-2.5 py-1 text-[10px] font-semibold border transition-all"
                      style={sizes.includes(s)
                        ? { backgroundColor: '#6366f1', color: '#fff', borderColor: '#6366f1' }
                        : { backgroundColor: 'transparent', color: '#6b7280', borderColor: '#e5e7eb' }
                      }
                    >
                      {s.split(' ')[0]}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-2">Reference URLs</label>
              {refUrls.map((url, i) => (
                <input
                  key={i} type="url" value={url}
                  onChange={e => setRefUrls(prev => prev.map((u, j) => j === i ? e.target.value : u))}
                  placeholder="https://..."
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 transition-all mb-2"
                />
              ))}
              <button
                type="button" onClick={() => setRefUrls(prev => [...prev, ''])}
                className="text-xs font-semibold text-gray-400 hover:text-gray-600 transition-colors"
              >
                + Add URL
              </button>
            </div>
            <div className="flex gap-3 pt-2 border-t border-gray-100">
              <button
                type="button" onClick={onClose}
                className="flex-1 rounded-xl border border-gray-200 py-3 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit" disabled={saving || !name.trim()}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-50 transition-opacity"
                style={{ backgroundColor: clientColor }}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {saving ? 'Creating…' : 'Create Brief'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
