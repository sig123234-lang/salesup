'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell
} from 'recharts'
import {
  Users, TrendingUp, CheckCircle2, Phone, Navigation,
  Target, Award
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/useAuth'
import { SALES_STATUS_CONFIG } from '@/lib/utils'
import { Client } from '@/types'
import Link from 'next/link'

const COLORS = ['#3b82f6', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#06b6d4', '#f97316', '#84cc16']

interface AdminStats {
  totalMembers: number
  totalClients: number
  contracted: number
  totalCalls: number
  totalVisits: number
  conversionRate: number
}

interface MemberStatsItem {
  name: string
  clients: number
  calls: number
  visits: number
  contracts: number
}

interface StatusDatum {
  name: string
  value: number
}

interface MonthlyDatum {
  month: string
  count: number
}

type TopClientItem = Pick<Client, 'id' | 'name' | 'sales_status' | 'contract_probability'>

export default function AdminDashboardPage() {
  const { profile, isAdmin } = useAuth()
  const supabase = createClient()

  const [stats, setStats] = useState<AdminStats>({
    totalMembers: 0, totalClients: 0, contracted: 0,
    totalCalls: 0, totalVisits: 0, conversionRate: 0,
  })
  const [memberStats, setMemberStats] = useState<MemberStatsItem[]>([])
  const [statusData, setStatusData] = useState<StatusDatum[]>([])
  const [monthlyData, setMonthlyData] = useState<MonthlyDatum[]>([])
  const [topClients, setTopClients] = useState<TopClientItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile?.company_id || !isAdmin) return
    const companyId = profile.company_id

    let cancelled = false

    async function fetchAdminData() {
      const [membersRes, clientsRes, callsRes, visitsRes] = await Promise.all([
        supabase.from('profiles').select('id, full_name, email, role').eq('company_id', companyId),
        supabase.from('clients').select('*').eq('company_id', companyId),
        supabase.from('call_records').select('id, user_id, created_at').eq('company_id', companyId),
        supabase.from('visit_records').select('id, user_id, created_at').eq('company_id', companyId),
      ])

      if (cancelled) return

      const members = membersRes.data || []
      const clients = clientsRes.data || []
      const calls = callsRes.data || []
      const visits = visitsRes.data || []

      const contracted = clients.filter((client) => client.sales_status === 'CONTRACTED').length
      const memberStatsData: MemberStatsItem[] = members.map((member) => ({
        name: member.full_name,
        clients: clients.filter((client) => client.owner_id === member.id).length,
        calls: calls.filter((call) => call.user_id === member.id).length,
        visits: visits.filter((visit) => visit.user_id === member.id).length,
        contracts: clients.filter((client) => client.owner_id === member.id && client.sales_status === 'CONTRACTED').length,
      }))

      const statusCount: Record<string, number> = {}
      clients.forEach((client) => {
        statusCount[client.sales_status] = (statusCount[client.sales_status] || 0) + 1
      })

      const monthlyContract: Record<string, number> = {}
      const now = new Date()
      for (let index = 5; index >= 0; index--) {
        const date = new Date(now.getFullYear(), now.getMonth() - index, 1)
        const key = `${date.getMonth() + 1}월`
        monthlyContract[key] = 0
      }
      clients
        .filter((client) => client.sales_status === 'CONTRACTED')
        .forEach((client) => {
          const date = new Date(client.updated_at)
          const key = `${date.getMonth() + 1}월`
          if (key in monthlyContract) monthlyContract[key]++
        })

      const topClientsData = clients
        .sort((a, b) => b.contract_probability - a.contract_probability)
        .slice(0, 5) as TopClientItem[]

      setStats({
        totalMembers: members.length,
        totalClients: clients.length,
        contracted,
        totalCalls: calls.length,
        totalVisits: visits.length,
        conversionRate: clients.length > 0 ? Math.round((contracted / clients.length) * 100) : 0,
      })
      setMemberStats(memberStatsData)
      setStatusData(
        Object.entries(statusCount).map(([status, count]) => ({
          name: SALES_STATUS_CONFIG[status as keyof typeof SALES_STATUS_CONFIG]?.label || status,
          value: count,
        }))
      )
      setMonthlyData(Object.entries(monthlyContract).map(([month, count]) => ({ month, count })))
      setTopClients(topClientsData)
      setLoading(false)
    }

    void fetchAdminData()

    return () => {
      cancelled = true
    }
  }, [isAdmin, profile, supabase])

  if (!isAdmin) {
    return (
      <div className="p-8 text-center">
        <p className="text-slate-500">관리자 권한이 필요합니다.</p>
        <Link href="/dashboard" className="mt-4 inline-block text-blue-600">돌아가기</Link>
      </div>
    )
  }

  if (loading) {
    return <div className="p-8 text-center text-slate-500">로딩 중...</div>
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">관리자 대시보드</h1>
        <p className="text-slate-500 text-sm mt-1">팀 전체 영업 현황 및 AI 분석</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
        {[
          { label: '팀 멤버', value: stats.totalMembers, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: '전체 거래처', value: stats.totalClients, icon: Target, color: 'text-indigo-600', bg: 'bg-indigo-50' },
          { label: '계약 완료', value: stats.contracted, icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50' },
          { label: '전환율', value: `${stats.conversionRate}%`, icon: TrendingUp, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: '통화 기록', value: stats.totalCalls, icon: Phone, color: 'text-purple-600', bg: 'bg-purple-50' },
          { label: '방문 기록', value: stats.totalVisits, icon: Navigation, color: 'text-teal-600', bg: 'bg-teal-50' },
        ].map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-100 dark:border-slate-700 shadow-sm"
          >
            <div className={`w-9 h-9 ${s.bg} dark:bg-opacity-20 rounded-xl flex items-center justify-center mb-2`}>
              <s.icon className={`w-5 h-5 ${s.color}`} />
            </div>
            <div className="text-xl font-bold text-slate-900 dark:text-white">{s.value}</div>
            <div className="text-xs text-slate-500">{s.label}</div>
          </motion.div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        {/* Monthly Contract Chart */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-5 shadow-sm">
          <h2 className="font-semibold text-slate-900 dark:text-white mb-4">월별 계약 현황</h2>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#94a3b8' }} />
              <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} />
              <Tooltip
                contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px' }}
              />
              <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2.5} dot={{ fill: '#3b82f6', r: 4 }} name="계약수" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Status Pie */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-5 shadow-sm">
          <h2 className="font-semibold text-slate-900 dark:text-white mb-4">영업 상태 분포</h2>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={statusData} cx="50%" cy="50%" outerRadius={70} dataKey="value" label={({ name, value }) => `${name} ${value}`} labelLine={false}>
                {statusData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Member Activity */}
      {memberStats.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-5 shadow-sm mb-6">
          <h2 className="font-semibold text-slate-900 dark:text-white mb-4">멤버별 활동 현황</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={memberStats}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <Tooltip contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px' }} />
              <Bar dataKey="clients" fill="#3b82f6" name="거래처" radius={[4, 4, 0, 0]} />
              <Bar dataKey="contracts" fill="#10b981" name="계약" radius={[4, 4, 0, 0]} />
              <Bar dataKey="calls" fill="#8b5cf6" name="통화" radius={[4, 4, 0, 0]} />
              <Bar dataKey="visits" fill="#f59e0b" name="방문" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Top Clients */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center gap-2">
          <Award className="w-4 h-4 text-amber-500" />
          <h2 className="font-semibold text-slate-900 dark:text-white">고확률 거래처 TOP 5</h2>
        </div>
        <div className="divide-y divide-slate-50 dark:divide-slate-700/50">
          {topClients.map((c, i) => {
            const sc = SALES_STATUS_CONFIG[c.sales_status as keyof typeof SALES_STATUS_CONFIG]
            return (
              <Link key={c.id} href={`/clients/${c.id}`}>
                <div className="flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900 dark:text-white text-sm truncate">{c.name}</p>
                    <span className={`text-xs ${sc?.bg} ${sc?.color} px-2 py-0.5 rounded-full`}>
                      {sc?.emoji} {sc?.label}
                    </span>
                  </div>
                  <div className="text-right">
                    <div className={`text-lg font-bold ${c.contract_probability >= 70 ? 'text-green-600' : c.contract_probability >= 40 ? 'text-amber-600' : 'text-red-500'}`}>
                      {c.contract_probability}%
                    </div>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
