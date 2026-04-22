'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// Stub placeholder — Part 3 of the notification redesign replaces this with
// a proper settings page that includes Profile / Notifications sections.
// For now, land on the existing notification preferences page.
export default function SettingsStubPage() {
  const router = useRouter()
  useEffect(() => {
    const target = typeof window !== 'undefined' && window.location.hash === '#notifications'
      ? '/account/notifications'
      : '/account/notifications'
    router.replace(target)
  }, [router])
  return <div className="p-8 text-sm text-gray-500">Opening settings…</div>
}
