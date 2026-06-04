'use client'

import { motion } from 'framer-motion'
import { Users, CheckCircle2, TrendingUp, Phone } from 'lucide-react'

interface StatsWidgetProps {
  totalClients: number
  contracted: number
  inProgress: number
  pendingFollowups: number
  conversionRate: number
}

export function StatsWidget({
  totalClients,
  contracted,
  inProgress,
  pendingFollowups,
  conversionRate,
}: StatsWidgetProps) {
  const cards = [
    {
      label: '전체 거래처',
      value: totalClients,
      icon: Users,
      color: 'text-blue-600',
      bg: 'bg-blue-50 dark:bg-blue-950',
      sub: '+3 이번 주',
    },
    {
      label: '계약 완료',
      value: contracted,
      icon: CheckCircle2,
      color: 'text-green-600',
      bg: 'bg-green-50 dark:bg-green-950',
      sub: `전환율 ${conversionRate}%`,
    },
    {
      label: '계약 진행중',
      value: inProgress,
      icon: TrendingUp,
      color: 'text-indigo-600',
      bg: 'bg-indigo-50 dark:bg-indigo-950',
      sub: '검토 필요',
    },
    {
      label: '후속 연락 예정',
      value: pendingFollowups,
      icon: Phone,
      color: 'text-amber-600',
      bg: 'bg-amber-50 dark:bg-amber-950',
      sub: '오늘 처리 필요',
      alert: pendingFollowups > 0,
    },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
      {cards.map((card, i) => (
        <motion.div
          key={card.label}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.06 }}
          className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-700 relative overflow-hidden"
        >
          {card.alert && (
            <span className="absolute top-3 right-3 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          )}
          <div className={`w-10 h-10 ${card.bg} rounded-xl flex items-center justify-center mb-3`}>
            <card.icon className={`w-5 h-5 ${card.color}`} />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">{card.value}</div>
          <div className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{card.label}</div>
          <div className="text-xs text-slate-400 dark:text-slate-500 mt-1">{card.sub}</div>
        </motion.div>
      ))}
    </div>
  )
}
