import { Sidebar } from '@/components/layout/Sidebar'

export default function HubLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="ml-64 flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
