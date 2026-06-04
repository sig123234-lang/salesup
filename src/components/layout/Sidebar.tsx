'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  Zap,
  Settings,
  LogOut,
  ChevronRight,
  Sliders,
} from 'lucide-react'
import { useAuth } from '@/lib/hooks/useAuth'
import { useViewConfig } from '@/lib/hooks/useViewConfig'
import { cn } from '@/lib/utils'
import { NavItem, NAV_ITEM_BY_ID, DEFAULT_NAV_CONFIG } from './navItems'
import { SidebarEditModal } from './SidebarEditModal'

export default function Sidebar() {
  const pathname = usePathname()
  const { profile, signOut, isAdmin } = useAuth()
  const { items, enabledItems, toggle, reorder } = useViewConfig(
    'sidebar_nav',
    DEFAULT_NAV_CONFIG
  )
  const [editOpen, setEditOpen] = useState(false)

  const isActive = (href: string, exact?: boolean) => {
    if (exact) return pathname === href
    return pathname.startsWith(href)
  }

  const orderedNav = enabledItems
    .map((it) => NAV_ITEM_BY_ID[it.id])
    .filter((n): n is NavItem => Boolean(n))
    .filter((n) => !n.admin || isAdmin)

  return (
    <>
      <aside className="hidden md:flex fixed left-0 top-0 h-full w-64 bg-white dark:bg-slate-900 border-r border-slate-100 dark:border-slate-800 flex-col z-40">
        {/* Logo */}
        <div className="h-16 flex items-center px-6 border-b border-slate-100 dark:border-slate-800">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-md shadow-blue-500/30">
              <Zap className="w-5 h-5 text-white" strokeWidth={2.5} />
            </div>
            <span className="font-bold text-slate-900 dark:text-white text-lg tracking-tight">SalesUp</span>
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-1">
          {orderedNav.map(({ href, icon: Icon, label, exact }) => (
            <Link key={href} href={href}>
              <motion.div
                whileHover={{ x: 2 }}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group',
                  isActive(href, exact)
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                )}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                <span>{label}</span>
                {isActive(href, exact) && (
                  <ChevronRight className="w-4 h-4 ml-auto" />
                )}
              </motion.div>
            </Link>
          ))}

          {/* Edit nav */}
          <button
            onClick={() => setEditOpen(true)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-300 transition-all"
          >
            <Sliders className="w-4 h-4 flex-shrink-0" />
            <span>메뉴 편집</span>
          </button>
        </nav>

        {/* Profile */}
        <div className="p-3 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {profile?.full_name?.[0] || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                {profile?.full_name || '사용자'}
              </p>
              <p className="text-xs text-slate-500 truncate">{profile?.email}</p>
            </div>
            <button
              onClick={signOut}
              className="text-slate-400 hover:text-red-500 transition-colors"
              title="로그아웃"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
          <Link href="/settings">
            <div className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-700 transition-colors mt-1">
              <Settings className="w-4 h-4" />
              설정
            </div>
          </Link>
        </div>
      </aside>

      {editOpen && (
        <SidebarEditModal
          items={items}
          isAdmin={isAdmin}
          onToggle={toggle}
          onReorder={reorder}
          onClose={() => setEditOpen(false)}
        />
      )}
    </>
  )
}
