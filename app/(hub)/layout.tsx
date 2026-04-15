import { Sidebar } from '@/components/layout/Sidebar'

export default function HubLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-zinc-100">
      <Sidebar />
      <main className="ml-56 flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
