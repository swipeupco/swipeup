'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

type Mode = 'login' | 'forgot' | 'sent'

export default function LoginPage() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [mode, setMode]         = useState<Mode>('login')
  const router = useRouter()

  async function handleLogin(e: React.FormEvent) {
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
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'https://hub.swipeupco.com/api/auth/callback?next=/reset-password',
    })
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
                  placeholder="you@swipeupco.com"
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
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-zinc-300">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  placeholder="you@swipeupco.com"
                  className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-[#14C29F] focus:outline-none focus:ring-2 focus:ring-[#14C29F]/20"
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
                {loading ? 'Signing in…' : 'Sign in'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
