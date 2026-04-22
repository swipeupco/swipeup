'use client'

import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import { Moon, Sun, Check } from 'lucide-react'

export default function AppearanceSettings() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const options = [
    { value: 'dark',  label: 'Dark',  description: 'The default. Lower eye-strain for long editing sessions.', icon: Moon  },
    { value: 'light', label: 'Light', description: 'High-contrast alternative for bright environments.',       icon: Sun   },
  ]

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 space-y-6 max-w-xl">
      <div>
        <h2 className="text-base font-semibold text-[var(--text)]">Appearance</h2>
        <p className="text-sm text-[var(--text-muted)] mt-0.5">Choose how the Hub looks. This preference follows your account.</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {options.map(opt => {
          const selected = mounted && theme === opt.value
          return (
            <button
              key={opt.value}
              onClick={() => setTheme(opt.value)}
              className={`relative flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition-colors ${
                selected
                  ? 'border-[var(--brand)] bg-[var(--brand-soft)]'
                  : 'border-[var(--border)] bg-[var(--surface-2)] hover:bg-[var(--surface-3)]'
              }`}
            >
              <div className="flex items-center gap-2">
                <opt.icon className={`h-4 w-4 ${selected ? 'text-[var(--brand)]' : 'text-[var(--text-muted)]'}`} />
                <span className={`text-sm font-semibold ${selected ? 'text-[var(--brand)]' : 'text-[var(--text)]'}`}>
                  {opt.label}
                </span>
                {selected && <Check className="h-3.5 w-3.5 text-[var(--brand)] ml-auto" />}
              </div>
              <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">{opt.description}</p>
            </button>
          )
        })}
      </div>
    </div>
  )
}
