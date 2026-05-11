import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/layout/Sidebar'
import MobileNav from '@/components/layout/MobileNav'
import QuickCapture from '@/components/quick-capture/QuickCapture'
import FloatingAIButton from '@/components/quick-capture/FloatingAIButton'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !['COMPANY_ADMIN', 'SUPER_ADMIN'].includes(profile.role)) {
    redirect('/dashboard')
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex">
      <Sidebar />
      <main className="flex-1 flex flex-col min-h-screen md:ml-64">
        <div className="flex-1 pb-20 md:pb-0">{children}</div>
      </main>
      <MobileNav />
      <FloatingAIButton />
      <QuickCapture />
    </div>
  )
}
