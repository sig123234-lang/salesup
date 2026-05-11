'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Users, Kanban, Map, Brain } from 'lucide-react'
import { cn } from '@/lib/utils'

const mobileNav = [
  { href: '/dashboard', icon: LayoutDashboard, label: '홈' },
  { href: '/clients', icon: Users, label: '거래처' },
  { href: '/kanban', icon: Kanban, label: '현황' },
  { href: '/map', icon: Map, label: '지도' },
  { href: '/ai-insights', icon: Brain, label: 'AI' },
]

export default function MobileNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 safe-area-pb">
      <div className="flex items-center justify-around px-2 py-2">
        {mobileNav.map(({ href, icon: Icon, label }) => {
          const active = href === '/dashboard' ? pathname === href : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-all min-w-[60px]',
                active
                  ? 'text-blue-600'
                  : 'text-slate-400 dark:text-slate-600'
              )}
            >
              <Icon className={cn('w-6 h-6 transition-transform', active && 'scale-110')} />
              <span className="text-[10px] font-medium">{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
