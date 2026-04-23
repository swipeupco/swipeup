'use client'

/**
 * BriefAttachments — Files section inside the BriefPanel drawer.
 *
 * Handles upload, preview, delete, and cover-switching against the
 * `brief_attachments` table + `brief-attachments` Storage bucket. Image
 * previews render inline; PDFs render a styled icon placeholder.
 *
 * Cover logic: marking a row `is_cover=true` via the partial unique index
 * ensures at most one cover per brief. The component also dual-writes
 * `briefs.cover_url` so the existing BriefCard.cover_url path keeps working
 * across the Hub and the Portal without either side needing to know about
 * brief_attachments.
 */

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Star, Trash2, UploadCloud, FileText, Loader2 } from 'lucide-react'

interface Attachment {
  id: string
  brief_id: string
  user_id: string
  storage_path: string
  file_name: string
  mime_type: string
  size_bytes: number
  is_cover: boolean
  created_at: string
  public_url?: string
}

const MAX_BYTES = 10 * 1024 * 1024 // 10 MB
const ACCEPT_MIME = new Set<string>([
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif',
  'application/pdf',
])

function isImageMime(m: string) { return m.startsWith('image/') }

export default function BriefAttachments({
  briefId, clientColor = '#4950F8',
}: {
  briefId: string
  clientColor?: string
}) {
  const [items, setItems] = useState<Attachment[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [settingCoverId, setSettingCoverId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function withPublicUrl(rows: Attachment[]): Attachment[] {
    const supabase = createClient()
    return rows.map(r => {
      const { data: { publicUrl } } = supabase.storage.from('brief-attachments').getPublicUrl(r.storage_path)
      return { ...r, public_url: publicUrl }
    })
  }

  async function load() {
    const supabase = createClient()
    const { data } = await supabase
      .from('brief_attachments')
      .select('*')
      .eq('brief_id', briefId)
      .order('created_at', { ascending: true })
    setItems(withPublicUrl((data as Attachment[]) ?? []))
    setLoading(false)
  }

  useEffect(() => {
    load()
    const supabase = createClient()
    const channel = supabase
      .channel(`brief-attachments-${briefId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'brief_attachments',
        filter: `brief_id=eq.${briefId}`,
      }, () => load())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [briefId])

  async function uploadOne(file: File) {
    if (!ACCEPT_MIME.has(file.type)) {
      setError(`Unsupported file type "${file.type || 'unknown'}". Only JPG, PNG, WebP, GIF, and PDF are allowed.`)
      return
    }
    if (file.size > MAX_BYTES) {
      setError('File too large. Please upload to Google Drive and paste the link as a comment instead.')
      return
    }
    setError(null)
    setUploading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setUploading(false); return }

    const ext = file.name.includes('.') ? file.name.split('.').pop() : ''
    const objectName = `${crypto.randomUUID()}${ext ? `.${ext}` : ''}`
    const storagePath = `${briefId}/${objectName}`

    const { error: uploadErr } = await supabase.storage
      .from('brief-attachments')
      .upload(storagePath, file, { contentType: file.type, upsert: false })
    if (uploadErr) {
      setError(`Upload failed: ${uploadErr.message}`)
      setUploading(false)
      return
    }

    // First attachment for this brief auto-becomes the cover.
    const { data: existing } = await supabase
      .from('brief_attachments')
      .select('id')
      .eq('brief_id', briefId)
      .limit(1)
    const shouldBeCover = (existing?.length ?? 0) === 0

    const { data: inserted, error: insertErr } = await supabase
      .from('brief_attachments')
      .insert({
        brief_id:     briefId,
        user_id:      user.id,
        storage_path: storagePath,
        file_name:    file.name,
        mime_type:    file.type,
        size_bytes:   file.size,
        is_cover:     shouldBeCover,
      })
      .select('*')
      .single()
    if (insertErr) {
      setError(`DB insert failed: ${insertErr.message}`)
      // Best-effort cleanup so we don't leave orphan objects in Storage.
      await supabase.storage.from('brief-attachments').remove([storagePath])
      setUploading(false)
      return
    }

    if (shouldBeCover && inserted) {
      const { data: { publicUrl } } = supabase.storage.from('brief-attachments').getPublicUrl(storagePath)
      // Dual-write briefs.cover_url so the existing BriefCard.cover_url path
      // keeps working without needing to join brief_attachments.
      await supabase.from('briefs').update({ cover_url: publicUrl }).eq('id', briefId)
    }
    setUploading(false)
  }

  async function handleFiles(fileList: FileList | null) {
    if (!fileList) return
    for (const f of Array.from(fileList)) {
      await uploadOne(f)
    }
  }

  async function deleteOne(a: Attachment) {
    if (!confirm(`Delete "${a.file_name}"?`)) return
    setDeletingId(a.id)
    const supabase = createClient()
    await supabase.storage.from('brief-attachments').remove([a.storage_path])
    await supabase.from('brief_attachments').delete().eq('id', a.id)
    if (a.is_cover) {
      // Cover gone — find the next attachment and promote it, or null
      // out briefs.cover_url if this was the last one.
      const remaining = items.filter(x => x.id !== a.id)
      if (remaining.length) {
        const next = remaining[0]
        await supabase.from('brief_attachments').update({ is_cover: true }).eq('id', next.id)
        const { data: { publicUrl } } = supabase.storage.from('brief-attachments').getPublicUrl(next.storage_path)
        await supabase.from('briefs').update({ cover_url: publicUrl }).eq('id', a.brief_id)
      } else {
        await supabase.from('briefs').update({ cover_url: null }).eq('id', a.brief_id)
      }
    }
    setDeletingId(null)
  }

  async function setAsCover(a: Attachment) {
    if (a.is_cover) return
    setSettingCoverId(a.id)
    const supabase = createClient()
    // Clear existing cover first so the partial unique index doesn't reject
    // the flip. Two UPDATEs rather than one so the constraint holds between
    // steps.
    const previousCover = items.find(x => x.is_cover && x.id !== a.id)
    if (previousCover) {
      await supabase.from('brief_attachments').update({ is_cover: false }).eq('id', previousCover.id)
    }
    await supabase.from('brief_attachments').update({ is_cover: true }).eq('id', a.id)
    const { data: { publicUrl } } = supabase.storage.from('brief-attachments').getPublicUrl(a.storage_path)
    await supabase.from('briefs').update({ cover_url: publicUrl }).eq('id', a.brief_id)
    setSettingCoverId(null)
  }

  function onDropZone(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    handleFiles(e.dataTransfer.files)
  }

  return (
    <div>
      <p className="text-[11px] font-semibold text-gray-400 dark:text-zinc-400 uppercase tracking-wider mb-2">Files</p>

      {/* Thumbnail grid */}
      {loading ? (
        <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-zinc-500 py-3">
          <Loader2 className="h-3 w-3 animate-spin" /> Loading files…
        </div>
      ) : items.length > 0 ? (
        <div className="grid grid-cols-4 gap-2 mb-3">
          {items.map(a => (
            <div
              key={a.id}
              className="group relative h-[72px] rounded-lg overflow-hidden border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.04]"
            >
              {isImageMime(a.mime_type) && a.public_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={a.public_url} alt={a.file_name} className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full flex flex-col items-center justify-center gap-1 p-1">
                  <FileText className="h-6 w-6 text-gray-400 dark:text-zinc-500" />
                  <span className="text-[9px] text-gray-500 dark:text-zinc-400 truncate w-full text-center">{a.file_name}</span>
                </div>
              )}

              {/* Cover star */}
              <button
                type="button"
                onClick={() => setAsCover(a)}
                disabled={settingCoverId === a.id}
                title={a.is_cover ? 'Cover image' : 'Set as cover'}
                className={`absolute top-1 left-1 h-6 w-6 rounded-md flex items-center justify-center transition-colors ${
                  a.is_cover
                    ? 'bg-amber-400 text-white'
                    : 'bg-black/50 text-white/70 hover:text-white hover:bg-black/70 opacity-0 group-hover:opacity-100'
                }`}
              >
                {settingCoverId === a.id
                  ? <Loader2 className="h-3 w-3 animate-spin" />
                  : <Star className="h-3 w-3" fill={a.is_cover ? 'currentColor' : 'none'} />
                }
              </button>

              {/* Delete */}
              <button
                type="button"
                onClick={() => deleteOne(a)}
                disabled={deletingId === a.id}
                title="Delete file"
                className="absolute top-1 right-1 h-6 w-6 rounded-md bg-black/50 text-white/70 hover:text-white hover:bg-red-500 transition-colors opacity-0 group-hover:opacity-100 flex items-center justify-center"
              >
                {deletingId === a.id
                  ? <Loader2 className="h-3 w-3 animate-spin" />
                  : <Trash2 className="h-3 w-3" />
                }
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {/* Drop zone */}
      <label
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDropZone}
        className={`flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed py-6 cursor-pointer transition-colors ${
          dragging
            ? 'border-[--drop-border] bg-[--drop-bg]'
            : 'border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.02] hover:bg-gray-100 dark:hover:bg-white/[0.04]'
        }`}
        style={{
          ['--drop-border' as string]: clientColor,
          ['--drop-bg' as string]: `${clientColor}12`,
        } as React.CSSProperties}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/jpeg,image/jpg,image/png,image/webp,image/gif,application/pdf"
          className="hidden"
          onChange={e => {
            const files = e.target.files
            e.target.value = ''
            handleFiles(files)
          }}
        />
        {uploading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin text-gray-400 dark:text-zinc-400" />
            <span className="text-xs text-gray-500 dark:text-zinc-400">Uploading…</span>
          </>
        ) : (
          <>
            <UploadCloud className="h-5 w-5 text-gray-400 dark:text-zinc-400" />
            <span className="text-xs font-medium text-gray-600 dark:text-zinc-300">Drop files here or click to upload</span>
            <span className="text-[10px] text-gray-400 dark:text-zinc-500">Images + PDF · 10 MB max</span>
          </>
        )}
      </label>

      {error && (
        <p className="text-xs text-red-500 dark:text-red-400 mt-2 px-1">{error}</p>
      )}
    </div>
  )
}
