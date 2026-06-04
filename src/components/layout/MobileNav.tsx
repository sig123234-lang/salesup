'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/hooks/useAuth'
import { useViewConfig } from '@/lib/hooks/useViewConfig'
import { NavItem, NAV_ITEM_BY_ID, DEFAULT_NAV_CONFIG } from './navItems'

const MOBILE_NAV_LIMIT = 5

export default function MobileNav() {
  const pathname = usePathname()
  const { isAdmin } = useAuth()
  const { enabledItems } = useViewConfig('sidebar_nav', DEFAULT_NAV_CONFIG)

  const visible = enabledItems
    .map((it) => NAV_ITEM_BY_ID[it.id])
    .filter((n): n is NavItem => Boolean(n))
    .filter((n) => !n.admin || isAdmin)
    .slice(0, MOBILE_NAV_LIMIT)

  if (visible.length === 0) return null

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 safe-area-pb">
      <div className="flex items-center justify-around px-2 py-2">
        {visible.map(({ href, icon: Icon, label, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href)
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
