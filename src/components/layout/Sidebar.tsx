'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  Zap,
  LayoutDashboard,
  Users,
  Kanban,
  Calendar,
  Map,
  Phone,
  Navigation,
  Brain,
  AlertTriangle,
  Settings,
  LogOut,
  ChevronRight,
  BarChart3,
} from 'lucide-react'
import { useAuth } from '@/lib/hooks/useAuth'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/dashboard', icon: LayoutDashboard, label: '대시보드', exact: true },
  { href: '/clients', icon: Users, label: '거래처' },
  { href: '/kanban', icon: Kanban, label: '영업 현황' },
  { href: '/calendar', icon: Calendar, label: '캘린더' },
  { href: '/map', icon: Map, label: '지도' },
  { href: '/calls', icon: Phone, label: '통화 기록' },
  { href: '/visits', icon: Navigation, label: '방문 기록' },
  { href: '/ai-insights', icon: Brain, label: 'AI 인사이트' },
  { href: '/claims', icon: AlertTriangle, label: '클레임' },
]

const adminItems = [
  { href: '/admin/dashboard', icon: BarChart3, label: '관리자 현황' },
  { href: '/admin/members', icon: Users, label: '멤버 관리' },
  { href: '/admin/analytics', icon: Brain, label: 'AI 리포트' },
]

export default function Sidebar() {
  const pathname = usePathname()
  const { profile, signOut, isAdmin } = useAuth()

  const isActive = (href: string, exact?: boolean) => {
    if (exact) return pathname === href
    return pathname.startsWith(href)
  }

  const NavLink = ({ href, icon: Icon, label, exact }: typeof navItems[0]) => (
    <Link href={href}>
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
  )

  return (
    <>
      {/* Desktop Sidebar */}
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
          {navItems.map((item) => (
            <NavLink key={item.href} {...item} />
          ))}

          {isAdmin && (
            <>
              <div className="pt-4 pb-2 px-3">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">관리자</span>
              </div>
              {adminItems.map((item) => (
                <NavLink key={item.href} {...item} />
              ))}
            </>
          )}
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
    </>
  )
}
