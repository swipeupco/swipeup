// Shared pipeline stage definitions — single source of truth for both kanban boards

export const CLIENT_STAGES = [
  { key: 'backlog',       label: 'Backlog',       color: 'bg-zinc-50',    header: 'bg-zinc-200',   text: 'text-zinc-700' },
  { key: 'in_production', label: 'In Production', color: 'bg-amber-50',   header: 'bg-amber-200',  text: 'text-amber-800' },
  { key: 'qa_review',     label: 'QA Review',     color: 'bg-purple-50',  header: 'bg-purple-200', text: 'text-purple-800' },
  { key: 'client_review', label: 'Client Review', color: 'bg-blue-50',    header: 'bg-blue-200',   text: 'text-blue-800' },
  { key: 'approved',      label: 'Approved',      color: 'bg-green-50',   header: 'bg-green-200',  text: 'text-green-800' },
]

export const INTERNAL_STAGES = [
  { key: 'in_production',      label: 'In Production', short: 'In Prod',   dotColor: '#3b82f6', bgColor: '#eff6ff',  badge: 'bg-blue-100 text-blue-700' },
  { key: 'in_review',          label: 'In Review',     short: 'In Review', dotColor: '#8b5cf6', bgColor: '#f5f3ff',  badge: 'bg-violet-100 text-violet-700' },
  { key: 'revisions_required', label: 'Revisions',     short: 'Revisions', dotColor: '#ef4444', bgColor: '#fef2f2',  badge: 'bg-red-100 text-red-700' },
  { key: 'approved_by_client', label: 'Approved',      short: 'Approved',  dotColor: '#22c55e', bgColor: '#f0fdf4',  badge: 'bg-green-100 text-green-700' },
]

export const CLIENT_STAGE_LABELS: Record<string, string> = Object.fromEntries(
  CLIENT_STAGES.map(s => [s.key, s.label])
)

export const INTERNAL_STAGE_LABELS: Record<string, string> = Object.fromEntries(
  INTERNAL_STAGES.map(s => [s.key, s.label])
)

export const INTERNAL_STAGE_BADGES: Record<string, string> = Object.fromEntries(
  INTERNAL_STAGES.map(s => [s.key, s.badge])
)
