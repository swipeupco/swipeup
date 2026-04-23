'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Loader2, UserPlus, Check, X, Users, ShieldCheck, Sparkles } from 'lucide-react'

interface TeamMember {
  id: string
  name: string | null
  avatar_url: string | null
  email: string | null
  role: 'admin' | 'designer'
  default_client_ids: string[]
}

interface ClientRow { id: string; name: string; color: string; logo_url: string | null }

export function TeamTab() {
  const [team, setTeam] = useState<TeamMember[]>([])
  const [clients, setClients] = useState<ClientRow[]>([])
  const [loading, setLoading] = useState(true)
  const [seeding, setSeeding] = useState(false)
  const [seededMessage, setSeededMessage] = useState<string | null>(null)
  const [showInvite, setShowInvite] = useState(false)

  async function load() {
    const [teamRes, { data: clientRows }] = await Promise.all([
      fetch('/api/team/list').then(r => r.json()),
      createClient().from('clients').select('id, name, color, logo_url').order('name'),
    ])
    setTeam(teamRes.team ?? [])
    setClients((clientRows as ClientRow[]) ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function updateRole(userId: string, role: 'admin' | 'designer') {
    setTeam(prev => prev.map(m => m.id === userId ? { ...m, role } : m))
    await fetch('/api/team/upsert-role', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, role }),
    })
  }

  async function toggleAssignment(staffId: string, clientId: string, hasIt: boolean) {
    setTeam(prev => prev.map(m => {
      if (m.id !== staffId) return m
      const nextIds = hasIt ? m.default_client_ids.filter(id => id !== clientId) : [...m.default_client_ids, clientId]
      return { ...m, default_client_ids: nextIds }
    }))
    await fetch('/api/team/client-assignments', {
      method: hasIt ? 'DELETE' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ staffId, clientId }),
    })
  }

  async function seedDemo() {
    setSeeding(true); setSeededMessage(null)
    const res = await fetch('/api/team/seed', { method: 'POST' })
    const json = await res.json()
    setSeeding(false)
    if (json.error) { setSeededMessage(`Error: ${json.error}`); return }
    const newOnes = (json.users as Array<{ email: string; alreadyExisted: boolean; password: string | null }>)?.filter(u => !u.alreadyExisted)
    if (newOnes?.length) {
      setSeededMessage(`Created ${newOnes.length} user${newOnes.length === 1 ? '' : 's'}. Temp passwords logged server-side.`)
    } else {
      setSeededMessage('No new users created — everyone already exists.')
    }
    load()
  }

  const demoCount = useMemo(() => team.filter(m => m.email?.includes('@swipeupco.test')).length, [team])

  if (loading) return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="h-5 w-5 animate-spin text-[var(--brand)]" />
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 space-y-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-[var(--text)]">Team</h2>
            <p className="text-sm text-[var(--text-muted)] mt-0.5">
              {team.length} {team.length === 1 ? 'member' : 'members'} · Hub access + default client assignments
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={seedDemo}
              disabled={seeding}
              title="Seed Sophie + demo designers so you can see the team UI populated"
              className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-3)] transition-colors disabled:opacity-60"
            >
              {seeding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              Seed demo team
            </button>
            <button
              onClick={() => setShowInvite(true)}
              className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold text-white bg-[var(--brand)] hover:bg-[var(--brand-hover)] transition-colors"
            >
              <UserPlus className="h-3.5 w-3.5" />
              Invite teammate
            </button>
          </div>
        </div>

        {seededMessage && (
          <div className="rounded-xl border border-[var(--brand)]/30 bg-[var(--brand-soft)] px-4 py-2.5 text-xs text-[var(--brand)]">
            {seededMessage}
          </div>
        )}

        {team.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-2)] p-8 flex flex-col items-center text-center">
            <Users className="h-8 w-8 text-[var(--text-dim)] mb-3" />
            <p className="text-sm font-medium text-[var(--text)]">No team members yet</p>
            <p className="text-xs text-[var(--text-muted)] mt-1">Invite a teammate or seed the demo team to populate this view.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {team.map(m => (
              <TeamMemberRow
                key={m.id}
                member={m}
                clients={clients}
                onRoleChange={role => updateRole(m.id, role)}
                onToggleAssignment={clientId => toggleAssignment(m.id, clientId, m.default_client_ids.includes(clientId))}
              />
            ))}
          </div>
        )}
      </div>

      {demoCount > 0 && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-4 text-xs text-[var(--text-muted)] leading-relaxed">
          <span className="font-medium text-[var(--text)]">Note:</span> {demoCount} demo user{demoCount === 1 ? '' : 's'} present (emails ending in <code className="font-mono text-[var(--text)]">@swipeupco.test</code>). To remove them, delete the corresponding rows in the Supabase Auth dashboard — their profile rows will cascade.
        </div>
      )}

      {showInvite && (
        <InviteModal onClose={() => setShowInvite(false)} onDone={() => { setShowInvite(false); load() }} />
      )}
    </div>
  )
}

// ─── Team Member Row ──────────────────────────────────────────────────────────

function TeamMemberRow({ member, clients, onRoleChange, onToggleAssignment }: {
  member: TeamMember
  clients: ClientRow[]
  onRoleChange: (role: 'admin' | 'designer') => void
  onToggleAssignment: (clientId: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const isAdmin = member.role === 'admin'

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="h-9 w-9 rounded-full bg-[var(--surface-3)] overflow-hidden flex items-center justify-center flex-shrink-0">
          {member.avatar_url
            ? <img src={member.avatar_url} alt="" className="h-full w-full object-cover" />
            : <span className="text-xs font-bold text-[var(--text)]">{(member.name ?? member.email ?? '?').slice(0, 1).toUpperCase()}</span>
          }
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-[var(--text)] truncate">{member.name ?? '—'}</p>
          <p className="text-xs text-[var(--text-muted)] truncate">{member.email}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="flex rounded-lg border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
            {(['admin', 'designer'] as const).map(r => (
              <button
                key={r}
                onClick={() => onRoleChange(r)}
                className={`px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                  member.role === r
                    ? (r === 'admin' ? 'bg-[var(--brand-soft)] text-[var(--brand)]' : 'bg-[var(--surface-3)] text-[var(--text)]')
                    : 'text-[var(--text-dim)] hover:text-[var(--text)]'
                }`}
              >
                {r === 'admin' ? <ShieldCheck className="h-3 w-3 inline mr-1" /> : null}
                {r}
              </button>
            ))}
          </div>
          <button
            onClick={() => setExpanded(v => !v)}
            className="rounded-lg px-3 py-1 text-[11px] font-medium border border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-3)] transition-colors"
          >
            {member.default_client_ids.length > 0 ? `${member.default_client_ids.length} client${member.default_client_ids.length === 1 ? '' : 's'}` : 'Assign clients'}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-[var(--border-muted)] bg-[var(--surface)] px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">Default client assignments</p>
          <p className="text-[11px] text-[var(--text-dim)] mb-3">
            New briefs from these clients auto-tag this {isAdmin ? 'admin' : 'designer'} as the default assignee.
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            {clients.length === 0 && (
              <p className="col-span-2 text-xs text-[var(--text-dim)] py-3 text-center">No clients yet.</p>
            )}
            {clients.map(c => {
              const has = member.default_client_ids.includes(c.id)
              return (
                <button
                  key={c.id}
                  onClick={() => onToggleAssignment(c.id)}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs transition-colors ${
                    has
                      ? 'border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand)]'
                      : 'border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-3)]'
                  }`}
                >
                  <div className="h-5 w-5 rounded flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0 overflow-hidden" style={{ backgroundColor: c.color }}>
                    {c.logo_url
                      ? <img src={c.logo_url} alt="" className="h-full w-full object-contain p-0.5 brightness-0 invert" />
                      : c.name.slice(0, 2).toUpperCase()
                    }
                  </div>
                  <span className="truncate flex-1 text-left font-medium">{c.name}</span>
                  {has && <Check className="h-3 w-3" />}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Invite Modal ─────────────────────────────────────────────────────────────

function InviteModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState<'admin' | 'designer'>('designer')
  const [inviting, setInviting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function sendInvite() {
    if (!email.trim()) return
    setInviting(true); setError(null)
    const res = await fetch('/api/invite-staff', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim(), name: name.trim() || null }),
    })
    const json = await res.json()
    if (json.error) { setError(json.error); setInviting(false); return }
    // Update their role after invite (invite-staff defaults to designer/staff)
    if (role === 'admin' && json.userId) {
      await fetch('/api/team/upsert-role', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: json.userId, role: 'admin' }),
      })
    }
    setInviting(false); setDone(true)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-bold text-[var(--text)]">Invite teammate</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-[var(--text-dim)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]"><X className="h-5 w-5" /></button>
        </div>
        {!done ? (
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide block mb-1.5">Name</label>
              <input
                value={name} onChange={e => setName(e.target.value)}
                placeholder="e.g. Jordan Smith"
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 text-sm text-[var(--text)] placeholder:text-[var(--text-dim)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-ring)] focus:border-[var(--brand)]"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide block mb-1.5">Email *</label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="jordan@swipeupco.com"
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 text-sm text-[var(--text)] placeholder:text-[var(--text-dim)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-ring)] focus:border-[var(--brand)]"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide block mb-1.5">Role</label>
              <div className="flex rounded-xl border border-[var(--border)] bg-[var(--surface-2)] overflow-hidden">
                {(['designer', 'admin'] as const).map(r => (
                  <button
                    key={r} type="button"
                    onClick={() => setRole(r)}
                    className={`flex-1 py-2 text-xs font-semibold transition-colors ${
                      role === r ? 'bg-[var(--brand)] text-white' : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                    }`}
                  >
                    {r === 'admin' ? <ShieldCheck className="h-3 w-3 inline mr-1" /> : null}
                    {r}
                  </button>
                ))}
              </div>
            </div>
            {error && <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-2">{error}</p>}
            <button
              onClick={sendInvite}
              disabled={inviting || !email.trim()}
              className="w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-white bg-[var(--brand)] hover:bg-[var(--brand-hover)] disabled:opacity-50 transition-colors"
            >
              {inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              {inviting ? 'Sending…' : 'Send invite'}
            </button>
          </div>
        ) : (
          <div className="text-center space-y-4">
            <div className="h-12 w-12 rounded-full bg-green-500/10 flex items-center justify-center mx-auto">
              <Check className="h-6 w-6 text-green-400" />
            </div>
            <div>
              <p className="font-semibold text-[var(--text)]">Invite sent to {email}</p>
              <p className="text-sm text-[var(--text-muted)] mt-1">They&apos;ll receive a Supabase invite email; once they accept, grant default client assignments below.</p>
            </div>
            <button onClick={onDone} className="w-full rounded-xl py-2.5 text-sm font-semibold text-white bg-[var(--brand)] hover:bg-[var(--brand-hover)] transition-colors">Done</button>
          </div>
        )}
      </div>
    </div>
  )
}
