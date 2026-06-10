import Sidebar from '@/components/ui/Sidebar'

export default function GameLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-octagon-dark">
      <Sidebar />
      <main className="flex-1 p-6 lg:p-8">{children}</main>
    </div>
  )
}
