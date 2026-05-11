'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Users, TrendingUp, Calendar, CheckCircle2, Phone,
  ArrowRight, Brain, Clock
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/useAuth'
import { formatRelativeTime, SALES_STATUS_CONFIG, getProbabilityColor } from '@/lib/utils'
import { Client, CalendarEvent } from '@/types'
import Link from 'next/link'

interface Stats {
  totalClients: number
  contracted: number
  inProgress: number
  todayVisits: number
  pendingFollowups: number
  conversionRate: number
}

export default function DashboardPage() {
  const { profile } = useAuth()
  const supabase = createClient()

  const [stats, setStats] = useState<Stats>({
    totalClients: 0, contracted: 0, inProgress: 0,
    todayVisits: 0, pendingFollowups: 0, conversionRate: 0
  })
  const [recentClients, setRecentClients] = useState<Client[]>([])
  const [upcomingEvents, setUpcomingEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile) return
    const currentProfile = profile

    let cancelled = false

    async function fetchDashboard() {
      const userId = currentProfile.id
      let clientsQuery = supabase.from('clients').select('*').order('updated_at', { ascending: false })

      if (currentProfile.company_id) {
        clientsQuery = clientsQuery.or(`owner_id.eq.${userId},company_id.eq.${currentProfile.company_id}`)
      } else {
        clientsQuery = clientsQuery.eq('owner_id', userId)
      }

      const [clientsRes, eventsRes] = await Promise.all([
        clientsQuery,
        supabase.from('calendar_events').select('*, client:clients(name)')
          .eq('user_id', userId)
          .gte('start_at', new Date().toISOString())
          .order('start_at')
          .limit(5),
      ])

      if (cancelled) return

      const clients = clientsRes.data || []
      const events = eventsRes.data || []

      const contracted = clients.filter((client) => client.sales_status === 'CONTRACTED').length
      const inProgress = clients.filter((client) => client.sales_status === 'CONTRACT_IN_PROGRESS').length
      const followUp = clients.filter(
        (client) => client.next_contact_at && new Date(client.next_contact_at) <= new Date()
      ).length

      setStats({
        totalClients: clients.length,
        contracted,
        inProgress,
        todayVisits: 0,
        pendingFollowups: followUp,
        conversionRate: clients.length > 0 ? Math.round((contracted / clients.length) * 100) : 0,
      })
      setRecentClients(clients.slice(0, 6) as Client[])
      setUpcomingEvents(events as CalendarEvent[])
      setLoading(false)
    }

    void fetchDashboard()

    return () => {
      cancelled = true
    }
  }, [profile, supabase])

  const statCards = [
    { label: '전체 거래처', value: stats.totalClients, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-950', change: '+3 이번 주' },
    { label: '계약 완료', value: stats.contracted, icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-950', change: `전환율 ${stats.conversionRate}%` },
    { label: '계약 진행중', value: stats.inProgress, icon: TrendingUp, color: 'text-indigo-600', bg: 'bg-indigo-50 dark:bg-indigo-950', change: '검토 필요' },
    { label: '후속 연락 예정', value: stats.pendingFollowups, icon: Phone, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950', change: '오늘 처리 필요', alert: stats.pendingFollowups > 0 },
  ]

  const getHourGreeting = () => {
    const h = new Date().getHours()
    if (h < 12) return '좋은 아침이에요'
    if (h < 18) return '좋은 오후에요'
    return '수고하셨어요'
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <p className="text-slate-500 dark:text-slate-400 text-sm mb-1">{getHourGreeting()} 👋</p>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          {profile?.full_name || '영업사원'}님의 오늘
        </h1>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-8">
        {statCards.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-700 relative overflow-hidden"
          >
            {stat.alert && (
              <span className="absolute top-3 right-3 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            )}
            <div className={`w-10 h-10 ${stat.bg} rounded-xl flex items-center justify-center mb-3`}>
              <stat.icon className={`w-5 h-5 ${stat.color}`} />
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white">{stat.value}</div>
            <div className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{stat.label}</div>
            <div className="text-xs text-slate-400 dark:text-slate-500 mt-1">{stat.change}</div>
          </motion.div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Recent Clients */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
          className="lg:col-span-2"
        >
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-700">
              <h2 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-500" />
                최근 거래처
              </h2>
              <Link href="/clients" className="text-sm text-blue-600 hover:text-blue-500 flex items-center gap-1">
                전체보기 <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            {loading ? (
              <div className="p-5 space-y-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-14 bg-slate-100 dark:bg-slate-700 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : recentClients.length === 0 ? (
              <div className="p-10 text-center text-slate-400">
                <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">거래처를 추가해보세요</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50 dark:divide-slate-700/50">
                {recentClients.map((client) => {
                  const sc = SALES_STATUS_CONFIG[client.sales_status]
                  return (
                    <Link key={client.id} href={`/clients/${client.id}`}>
                      <motion.div
                        whileHover={{ x: 2 }}
                        className="flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                      >
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-600 flex items-center justify-center text-slate-600 dark:text-slate-300 font-bold text-sm flex-shrink-0">
                          {client.name[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-slate-900 dark:text-white text-sm truncate">{client.name}</p>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${sc.bg} ${sc.color} flex-shrink-0`}>
                              {sc.emoji} {sc.label}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 mt-0.5">
                            {client.phone && (
                              <span className="text-xs text-slate-400 flex items-center gap-1">
                                <Phone className="w-3 h-3" />{client.phone}
                              </span>
                            )}
                            <span className="text-xs text-slate-400">
                              {formatRelativeTime(client.updated_at)}
                            </span>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className={`text-sm font-bold ${getProbabilityColor(client.contract_probability)}`}>
                            {client.contract_probability}%
                          </div>
                          <div className="text-xs text-slate-400">계약확률</div>
                        </div>
                      </motion.div>
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        </motion.div>

        {/* Right Panel */}
        <div className="space-y-4">
          {/* Upcoming Events */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.35 }}
            className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden"
          >
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-100 dark:border-slate-700">
              <h3 className="font-semibold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                <Calendar className="w-4 h-4 text-purple-500" />
                다가오는 일정
              </h3>
              <Link href="/calendar" className="text-xs text-blue-600">더보기</Link>
            </div>

            {upcomingEvents.length === 0 ? (
              <div className="p-6 text-center text-slate-400 text-sm">
                <Calendar className="w-8 h-8 mx-auto mb-2 opacity-30" />
                예정된 일정 없음
              </div>
            ) : (
              <div className="p-3 space-y-2">
                {upcomingEvents.map((event) => (
                  <div key={event.id} className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/50">
                    <div className="w-2 h-2 rounded-full bg-purple-500 mt-1.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{event.title}</p>
                      <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3" />
                        {new Date(event.start_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    {event.is_ai_generated && (
                      <span className="text-[10px] bg-blue-50 dark:bg-blue-950 text-blue-600 px-1.5 py-0.5 rounded-md flex-shrink-0">AI</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </motion.div>

          {/* AI Tip */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-4 text-white shadow-lg shadow-blue-500/20"
          >
            <div className="flex items-center gap-2 mb-2">
              <Brain className="w-4 h-4" />
              <span className="text-sm font-semibold">AI 추천</span>
            </div>
            <p className="text-sm text-blue-100 leading-relaxed">
              오늘 연락 예정인 고객이 {stats.pendingFollowups}명 있습니다. 후속 연락을 통해 계약 가능성을 높여보세요.
            </p>
            <Link href="/ai-insights">
              <button className="mt-3 text-xs bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1">
                인사이트 보기 <ArrowRight className="w-3 h-3" />
              </button>
            </Link>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
