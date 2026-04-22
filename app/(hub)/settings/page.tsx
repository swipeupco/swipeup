'use client'

import { NotificationSettingsSection } from '@/components/settings/NotificationSettingsSection'

export default function SettingsPage() {
  return (
    <div className="max-w-3xl mx-auto p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Settings</h1>
        <p className="text-zinc-500 mt-1">Manage your notifications and preferences</p>
      </div>

      <NotificationSettingsSection />
    </div>
  )
}
