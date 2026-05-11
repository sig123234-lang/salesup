import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/layout/Sidebar'
import MobileNav from '@/components/layout/MobileNav'
import QuickCapture from '@/components/quick-capture/QuickCapture'
import FloatingAIButton from '@/components/quick-capture/FloatingAIButton'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex">
      {/* Desktop Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-h-screen md:ml-64">
        <div className="flex-1 pb-20 md:pb-0">
          {children}
        </div>
      </main>

      {/* Mobile Bottom Nav */}
      <MobileNav />

      {/* Floating AI Button */}
      <FloatingAIButton />

      {/* Quick Capture Modal */}
      <QuickCapture />
    </div>
  )
}
