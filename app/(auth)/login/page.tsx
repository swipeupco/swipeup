'use client'

/**
 * Hub login — ported verbatim from the SwipeUp Portal's /login
 * (src/app/(auth)/login/page.tsx). The only intentional differences are:
 *
 *   - Heading:   "Team login"   (Portal: "Welcome back")
 *   - Subtitle:  "SwipeUp Creative Hub"  (Portal: "Sign in to your marketing portal")
 *   - Post-login redirect: '/'  (Hub's All Clients landing; Portal → /dashboard)
 *   - Reset redirect: window.location.origin/api/auth/callback
 *     (Portal hardcodes portal.swipeupco.com/auth/callback; Hub's callback lives
 *     under /api/ and we derive origin at runtime so dev + preview both work)
 *   - No public "Sign up" footer — the Hub is invite-only
 *   - No per-client subdomain lookup — the Hub isn't multi-tenant like the Portal
 *
 * All styling, spacing, and interaction chrome is identical.
 */

import React, { useState, useEffect, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'

type Mode = 'login' | 'forgot' | 'sent'

function LoginContent() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [mode, setMode]         = useState<Mode>('login')

  // Live clock (Portal parity)
  const [formattedDate, setFormattedDate] = useState<string | null>(null)

  useEffect(() => {
    const updateClock = () => {
      const now = new Date()
      setFormattedDate(new Intl.DateTimeFormat(undefined, {
        dateStyle: 'full',
        timeStyle: 'short',
      }).format(now))
    }
    updateClock()
    const timer = setInterval(updateClock, 1000)
    return () => clearInterval(timer)
  }, [])

  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const urlError = searchParams.get('error')
    if (urlError === 'reset_expired') {
      setError('Reset link expired or invalid. Please request a new one.')
    } else if (urlError === 'auth') {
      setError('Sign in failed. Please try again.')
    }
  }, [searchParams])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('Invalid email or password.')
      setLoading(false)
    } else {
      router.push('/')
      router.refresh()
    }
  }

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const redirectTo = `${window.location.origin}/api/auth/callback?next=/reset-password`
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      setMode('sent')
      setLoading(false)
    }
  }

  const logo = (
    <div className="flex justify-center mb-8">
      <Image
        src="/SwipeUp_White.svg"
        alt="SwipeUp"
        width={160}
        height={39}
        priority
      />
    </div>
  )

  const FooterClock = () => (
    <div className="flex flex-col items-center gap-1 mt-8">
      <p className="text-zinc-500 text-[10px] uppercase tracking-wider">
        {formattedDate || ''}
      </p>
      <p className="text-zinc-600 text-xs font-medium">
        Built by SwipeUp
      </p>
    </div>
  )

  if (mode === 'sent') {
    return (
      <div className="w-full max-w-sm">
        {logo}
        <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-8 shadow-2xl text-center">
          <p className="text-lg font-bold text-white mb-2">Check your email</p>
          <p className="text-sm text-zinc-400 mb-6">
            If an account exists for <span className="text-white">{email}</span>, you&apos;ll receive a reset link shortly.
          </p>
          <button
            onClick={() => { setMode('login'); setError(null) }}
            className="text-sm font-medium text-zinc-400 hover:text-white transition-colors"
          >
            ← Back to sign in
          </button>
        </div>
        <FooterClock />
      </div>
    )
  }

  return (
    <div className="w-full max-w-sm">
      {logo}

      <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-8 shadow-2xl">
        {mode === 'forgot' ? (
          <>
            <h1 className="text-xl font-bold text-white mb-1">Reset password</h1>
            <p className="text-sm text-zinc-400 mb-6">We&apos;ll send a reset link to your email.</p>
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-zinc-300">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  placeholder="you@example.com"
                  className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-[#4950F8] focus:outline-none focus:ring-2 focus:ring-[#4950F8]/20"
                />
              </div>
              {error && (
                <p className="text-sm text-red-400 rounded-lg bg-red-950 border border-red-900 px-3 py-2">{error}</p>
              )}
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg px-4 py-2.5 text-sm font-semibold text-white bg-[#4950F8] transition-opacity disabled:opacity-60"
              >
                {loading ? 'Sending…' : 'Send reset link'}
              </button>
              <button
                type="button"
                onClick={() => { setMode('login'); setError(null) }}
                className="w-full text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                ← Back to sign in
              </button>
            </form>
          </>
        ) : (
          <>
            <h1 className="text-xl font-bold text-white mb-1">Team login</h1>
            <p className="text-sm text-zinc-400 mb-6">SwipeUp Creative Hub</p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-zinc-300">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  placeholder="you@example.com"
                  className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-[#4950F8] focus:outline-none focus:ring-2 focus:ring-[#4950F8]/20"
                />
              </div>
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-zinc-300">Password</label>
                  <button
                    type="button"
                    onClick={() => { setMode('forgot'); setError(null) }}
                    className="text-xs font-medium text-zinc-500 hover:text-zinc-300 transition-colors"
                  >
                    Forgot password?
                  </button>
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
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
                <span className="relative z-10 drop-shadow-sm pointer-events-none">{loading ? 'Signing in…' : 'Sign in'}</span>
              </button>
            </form>
          </>
        )}
      </div>

      <FooterClock />
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  )
}
