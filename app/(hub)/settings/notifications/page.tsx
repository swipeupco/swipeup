'use client'

/**
 * Notifications settings — thin wrapper around the shared
 * NotificationSettingsSection component that main landed (and that reads/
 * writes the production `notification_preferences` table with per-event
 * rows). The Hub's earlier JSONB-on-profiles approach (Pass 1) was
 * schema-incompatible with what's live; we dropped it during the merge of
 * origin/main into this branch and delegate entirely to the component.
 */

import { NotificationSettingsSection } from '@/components/settings/NotificationSettingsSection'

export default function NotificationsSettings() {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 max-w-xl">
      <NotificationSettingsSection />
    </div>
  )
}
