'use client'

/**
 * Hub reset-password page — ported verbatim from the SwipeUp Portal's
 * /reset-password (src/app/(auth)/reset-password/page.tsx). No Hub-specific
 * changes; the page reads the session set by the auth callback and lets the
 * user choose a new password before being redirected to /login.
 */

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm]   = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [success, setSuccess]   = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)
  const router = useRouter()

  const [formattedDate, setFormattedDate] = useState<string | null>(null)
  useEffect(() => {
    const updateClock = () => {
      setFormattedDate(
        new Intl.DateTimeFormat(undefined, { dateStyle: 'full', timeStyle: 'short' })
          .format(new Date())
      )
    }
    updateClock()
    const timer = setInterval(updateClock, 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.replace('/login?error=reset_expired')
        return
      }
      setCheckingSession(false)
    })
  }, [router])

  function validate(): string | null {
    if (password.length < 8) return 'Password must be at least 8 characters.'
    if (password !== confirm) return 'Passwords do not match.'
    return null
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const validation = validate()
    if (validation) {
      setError(validation)
      return
    }
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }
    await supabase.auth.signOut()
    setSuccess(true)
    setTimeout(() => router.push('/login'), 2000)
  }

  const logo = (
    <div className="flex justify-center mb-8">
      <Image src="/SwipeUp_White.svg" alt="SwipeUp" width={160} height={39} priority />
    </div>
  )

  const FooterClock = () => (
    <div className="flex flex-col items-center gap-1 mt-8">
      <p className="text-zinc-500 text-[10px] uppercase tracking-wider">{formattedDate || ''}</p>
      <p className="text-zinc-600 text-xs font-medium">Built by SwipeUp</p>
    </div>
  )

  if (checkingSession) {
    return (
      <div className="w-full max-w-sm">
        {logo}
        <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-8 shadow-2xl text-center">
          <p className="text-sm text-zinc-400">Verifying reset link…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-sm">
      {logo}

      <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-8 shadow-2xl">
        {success ? (
          <div className="text-center py-4">
            <p className="text-lg font-bold text-white mb-2">Password updated</p>
            <p className="text-sm text-zinc-400">Redirecting to sign in…</p>
          </div>
        ) : (
          <>
            <h1 className="text-xl font-bold text-white mb-1">Reset your password</h1>
            <p className="text-sm text-zinc-400 mb-6">Choose a new password for your account</p>
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
                  className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-[#4950F8] focus:outline-none focus:ring-2 focus:ring-[#4950F8]/20"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-zinc-300">Confirm password</label>
                <input
                  type="password"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  required
                  minLength={8}
                  placeholder="••••••••"
                  className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-[#4950F8] focus:outline-none focus:ring-2 focus:ring-[#4950F8]/20"
                />
              </div>
              {error && (
                <p className="text-sm text-red-400 rounded-lg bg-red-950 border border-red-900 px-3 py-2">{error}</p>
              )}
              <button
                type="submit"
                disabled={loading}
                className="group relative w-full overflow-hidden rounded-lg px-4 py-3 text-sm font-semibold text-white transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]"
                style={{
                  background: 'linear-gradient(135deg, rgba(73, 80, 248, 0.95) 0%, rgba(73, 80, 248, 0.75) 50%, rgba(55, 62, 220, 0.9) 100%)',
                  backdropFilter: 'blur(10px)',
                  WebkitBackdropFilter: 'blur(10px)',
                  border: '1px solid rgba(255, 255, 255, 0.25)',
                  boxShadow: `
                    0 10px 30px rgba(73, 80, 248, 0.5),
                    0 4px 12px rgba(73, 80, 248, 0.4),
                    0 0 40px rgba(73, 80, 248, 0.25),
                    inset 0 1px 0 rgba(255, 255, 255, 0.3),
                    inset 0 -1px 0 rgba(0, 0, 0, 0.2)
                  `,
                }}
              >
                <div
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                  style={{
                    background: 'linear-gradient(135deg, rgba(73, 80, 248, 1) 0%, rgba(95, 102, 255, 0.95) 50%, rgba(73, 80, 248, 1) 100%)',
                    boxShadow: `
                      0 15px 40px rgba(73, 80, 248, 0.7),
                      0 6px 20px rgba(73, 80, 248, 0.5),
                      0 0 60px rgba(73, 80, 248, 0.4),
                      inset 0 1px 0 rgba(255, 255, 255, 0.4)
                    `,
                  }}
                />
                <span className="relative z-10 drop-shadow-sm pointer-events-none">
                  {loading ? 'Updating…' : 'Update password'}
                </span>
              </button>
            </form>
          </>
        )}
      </div>

      <FooterClock />
    </div>
  )
}
