'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2, Upload, Check, User as UserIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function ProfileSettings() {
  const [name, setName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      setEmail(user.email ?? '')
      const { data } = await supabase
        .from('profiles')
        .select('name, avatar_url')
        .eq('id', user.id)
        .maybeSingle()
      setName((data as { name?: string | null })?.name ?? '')
      setAvatarUrl((data as { avatar_url?: string | null })?.avatar_url ?? null)
      setLoading(false)
    })
  }, [])

  async function uploadAvatar(file: File) {
    if (!file.type.startsWith('image/')) return
    setUploading(true); setError(null)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setUploading(false); return }
    const ext = file.name.split('.').pop()
    const path = `staff/${user.id}/${Date.now()}.${ext}`
    const { error: uploadError } = await supabase.storage.from('client-assets').upload(path, file, { upsert: true })
    if (uploadError) { setError(uploadError.message); setUploading(false); return }
    const { data: { publicUrl } } = supabase.storage.from('client-assets').getPublicUrl(path)
    setAvatarUrl(publicUrl)
    setUploading(false)
  }

  async function save() {
    setSaving(true); setError(null)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }
    const { error: upErr } = await supabase
      .from('profiles')
      .update({ name: name.trim() || null, avatar_url: avatarUrl })
      .eq('id', user.id)
    setSaving(false)
    if (upErr) { setError(upErr.message); return }
    setSaved(true); setTimeout(() => setSaved(false), 2000)
  }

  if (loading) return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="h-5 w-5 animate-spin text-[var(--brand)]" />
    </div>
  )

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 space-y-6 max-w-xl">
      <div>
        <h2 className="text-base font-semibold text-[var(--text)]">Profile</h2>
        <p className="text-sm text-[var(--text-muted)] mt-0.5">How you appear to your team across the Hub.</p>
      </div>

      <div className="flex items-center gap-4">
        <div className="h-16 w-16 rounded-full bg-[var(--surface-3)] overflow-hidden flex items-center justify-center flex-shrink-0">
          {avatarUrl
            ? <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
            : <UserIcon className="h-6 w-6 text-[var(--text-dim)]" />
          }
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-1.5 text-xs font-medium text-[var(--text-muted)] hover:bg-[var(--surface-3)] hover:text-[var(--text)] transition-colors disabled:opacity-50"
          >
            {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
            {uploading ? 'Uploading…' : avatarUrl ? 'Replace' : 'Upload photo'}
          </button>
          {avatarUrl && (
            <button
              onClick={() => setAvatarUrl(null)}
              className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-500/10 transition-colors"
            >
              Remove
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) uploadAvatar(f) }}
          />
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide block mb-1.5">Name</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Your full name"
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 text-sm text-[var(--text)] placeholder:text-[var(--text-dim)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-ring)] focus:border-[var(--brand)]"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide block mb-1.5">Email</label>
          <input
            value={email}
            disabled
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-3)] px-3 py-2.5 text-sm text-[var(--text-dim)] cursor-not-allowed"
          />
          <p className="text-[11px] text-[var(--text-dim)] mt-1">Contact Eden to change your email.</p>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-400">{error}</div>
      )}

      <div className="flex justify-end">
        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-1.5 rounded-xl bg-[var(--brand)] hover:bg-[var(--brand-hover)] px-4 py-2 text-sm font-semibold text-white transition-colors disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : saved ? <Check className="h-3.5 w-3.5" /> : null}
          {saved ? 'Saved' : saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </div>
  )
}
