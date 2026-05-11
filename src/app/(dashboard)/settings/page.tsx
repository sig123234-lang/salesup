'use client'

import { motion } from 'framer-motion'
import { User, Bell, Shield, Palette, LogOut, ChevronRight, Moon, Sun, Monitor } from 'lucide-react'
import { useAuth } from '@/lib/hooks/useAuth'
import { useUIStore } from '@/store'
import { cn } from '@/lib/utils'

export default function SettingsPage() {
  const { profile, signOut } = useAuth()
  const { theme, setTheme } = useUIStore()

  const settingsSections = [
    {
      title: '계정',
      items: [
        { icon: User, label: '프로필 편집', desc: profile?.full_name || '', action: () => {} },
        { icon: Shield, label: '비밀번호 변경', desc: '보안 설정', action: () => {} },
      ],
    },
    {
      title: '환경설정',
      items: [
        { icon: Bell, label: '알림 설정', desc: '푸시 알림, 이메일', action: () => {} },
        { icon: Palette, label: '테마', desc: theme === 'light' ? '라이트' : theme === 'dark' ? '다크' : '시스템', action: () => {} },
      ],
    },
  ]

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto">
      <h1 className="text-xl font-bold text-slate-900 dark:text-white mb-6">설정</h1>

      {/* Profile Card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-5 mb-6 text-white shadow-lg shadow-blue-500/20"
      >
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center text-2xl font-bold">
            {profile?.full_name?.[0] || 'U'}
          </div>
          <div>
            <h2 className="font-bold text-lg">{profile?.full_name}</h2>
            <p className="text-blue-200 text-sm">{profile?.email}</p>
            <span className="text-xs bg-white/20 px-2.5 py-0.5 rounded-full mt-1 inline-block">
              {profile?.role === 'COMPANY_ADMIN' ? '회사 관리자' :
               profile?.role === 'SALES_MEMBER' ? '영업사원' :
               profile?.role === 'SUPER_ADMIN' ? '슈퍼 관리자' : '개인 사용자'}
            </span>
          </div>
        </div>
      </motion.div>

      {/* Theme */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-4 mb-4 shadow-sm">
        <h3 className="font-semibold text-slate-900 dark:text-white mb-3 text-sm">테마</h3>
        <div className="grid grid-cols-3 gap-2">
          {[
            { value: 'light', icon: Sun, label: '라이트' },
            { value: 'dark', icon: Moon, label: '다크' },
            { value: 'system', icon: Monitor, label: '시스템' },
          ].map(({ value, icon: Icon, label }) => (
            <button
              key={value}
              onClick={() => setTheme(value as 'light' | 'dark' | 'system')}
              className={cn(
                'flex flex-col items-center gap-2 py-3 rounded-xl text-sm font-medium transition-all',
                theme === value
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'
              )}
            >
              <Icon className="w-5 h-5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Settings sections */}
      {settingsSections.map((section) => (
        <div key={section.title} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 overflow-hidden mb-4 shadow-sm">
          <div className="px-5 py-3 border-b border-slate-50 dark:border-slate-700/50">
            <h3 className="font-semibold text-slate-900 dark:text-white text-sm">{section.title}</h3>
          </div>
          <div className="divide-y divide-slate-50 dark:divide-slate-700/50">
            {section.items.map((item) => (
              <button
                key={item.label}
                onClick={item.action}
                className="w-full flex items-center gap-3 px-5 py-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors text-left"
              >
                <div className="w-9 h-9 bg-slate-100 dark:bg-slate-700 rounded-xl flex items-center justify-center">
                  <item.icon className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-900 dark:text-white">{item.label}</p>
                  <p className="text-xs text-slate-400">{item.desc}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300" />
              </button>
            ))}
          </div>
        </div>
      ))}

      {/* App info */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-4 mb-4 shadow-sm">
        <div className="flex justify-between text-sm">
          <span className="text-slate-500">버전</span>
          <span className="text-slate-900 dark:text-white font-medium">1.0.0 MVP</span>
        </div>
        <div className="flex justify-between text-sm mt-2">
          <span className="text-slate-500">플랫폼</span>
          <span className="text-slate-900 dark:text-white font-medium">SalesUp PWA</span>
        </div>
      </div>

      {/* Logout */}
      <button
        onClick={signOut}
        className="w-full py-3.5 bg-red-50 dark:bg-red-950 text-red-600 rounded-2xl font-medium flex items-center justify-center gap-2 hover:bg-red-100 dark:hover:bg-red-900 transition-colors"
      >
        <LogOut className="w-5 h-5" />
        로그아웃
      </button>
    </div>
  )
}
