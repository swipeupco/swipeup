'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm]   = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [success, setSuccess]   = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      setSuccess(true)
      setTimeout(() => router.push('/login'), 2500)
    }
  }

  return (
    <div className="w-full max-w-sm">
      <div className="flex justify-center mb-8">
        <Image
          src="/SwipeUp_White.svg"
          alt="SwipeUp"
          width={160}
          height={39}
          priority
        />
      </div>

      <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-8 shadow-2xl">
        {success ? (
          <div className="text-center py-4">
            <p className="text-lg font-bold text-white mb-2">Password updated!</p>
            <p className="text-sm text-zinc-400">Redirecting to sign in…</p>
          </div>
        ) : (
          <>
            <h1 className="text-xl font-bold text-white mb-1">Set new password</h1>
            <p className="text-sm text-zinc-400 mb-6">Choose a strong password for your account.</p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-zinc-300">New password</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  minLength={8}
                  placeholder="••••••••"
                  className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-[#14C29F] focus:outline-none focus:ring-2 focus:ring-[#14C29F]/20"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-zinc-300">Confirm password</label>
                <input
                  type="password"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-[#14C29F] focus:outline-none focus:ring-2 focus:ring-[#14C29F]/20"
                />
              </div>
              {error && (
                <p className="text-sm text-red-400 rounded-lg bg-red-950 border border-red-900 px-3 py-2">{error}</p>
              )}
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg px-4 py-2.5 text-sm font-semibold text-white bg-[#14C29F] transition-opacity disabled:opacity-60"
              >
                {loading ? 'Updating…' : 'Update password'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
