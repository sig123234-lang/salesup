'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Cell
} from 'recharts'
import { Brain, TrendingUp, Target, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/useAuth'

interface ProbabilityBucket {
  range: string
  count: number
  color: string
}

interface IndustryDatum {
  name: string
  count: number
}

interface WeeklyDatum {
  date: string
  count: number
}

export default function AdminAnalyticsPage() {
  const { profile, isAdmin } = useAuth()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [probabilityDist, setProbabilityDist] = useState<ProbabilityBucket[]>([])
  const [industryData, setIndustryData] = useState<IndustryDatum[]>([])
  const [weeklyActivity, setWeeklyActivity] = useState<WeeklyDatum[]>([])
  const [aiReport, setAiReport] = useState<string>('')

  async function generateAIReport() {
    if (!profile?.company_id) return
    setGenerating(true)
    try {
      const { data: clients } = await supabase
        .from('clients')
        .select('name, sales_status, contract_probability, industry, last_contacted_at')
        .eq('company_id', profile!.company_id)
        .order('contract_probability', { ascending: false })
        .limit(20)

      const res = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: `팀 영업 현황 분석: ${JSON.stringify(clients)}`,
          type: 'report',
          clientContext: `총 ${clients?.length}개 거래처의 영업 현황`,
        }),
      })

      const { analysis } = await res.json()
      setAiReport(analysis?.summary || '분석 완료. 데이터를 검토해주세요.')
    } finally {
      setGenerating(false)
    }
  }

  useEffect(() => {
    if (!profile?.company_id || !isAdmin) return
    const companyId = profile.company_id

    let cancelled = false

    async function fetchAnalytics() {
      const { data: clients } = await supabase
        .from('clients')
        .select('contract_probability, industry, created_at, sales_status')
        .eq('company_id', companyId)

      if (cancelled) return

      if (!clients) {
        setLoading(false)
        return
      }

      const dist: ProbabilityBucket[] = [
        { range: '0-20%', count: 0, color: '#ef4444' },
        { range: '21-40%', count: 0, color: '#f97316' },
        { range: '41-60%', count: 0, color: '#f59e0b' },
        { range: '61-80%', count: 0, color: '#22c55e' },
        { range: '81-100%', count: 0, color: '#3b82f6' },
      ]
      clients.forEach((client) => {
        const probability = client.contract_probability
        if (probability <= 20) dist[0].count++
        else if (probability <= 40) dist[1].count++
        else if (probability <= 60) dist[2].count++
        else if (probability <= 80) dist[3].count++
        else dist[4].count++
      })

      const industryCount: Record<string, number> = {}
      clients.forEach((client) => {
        industryCount[client.industry] = (industryCount[client.industry] || 0) + 1
      })

      const weekData: Record<string, number> = {}
      const now = new Date()
      for (let index = 6; index >= 0; index--) {
        const date = new Date(now)
        date.setDate(date.getDate() - index)
        const key = `${date.getMonth() + 1}/${date.getDate()}`
        weekData[key] = 0
      }
      clients.forEach((client) => {
        const date = new Date(client.created_at)
        const key = `${date.getMonth() + 1}/${date.getDate()}`
        if (key in weekData) weekData[key]++
      })

      setProbabilityDist(dist)
      setIndustryData(
        Object.entries(industryCount)
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 8)
      )
      setWeeklyActivity(Object.entries(weekData).map(([date, count]) => ({ date, count })))
      setLoading(false)
    }

    void fetchAnalytics()

    return () => {
      cancelled = true
    }
  }, [isAdmin, profile, supabase])

  if (!isAdmin) {
    return <div className="p-8 text-center text-slate-500">관리자 권한이 필요합니다.</div>
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">AI 분석 리포트</h1>
          <p className="text-sm text-slate-500">팀 영업 데이터 AI 분석</p>
        </div>
        <button
          onClick={generateAIReport}
          disabled={generating}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-all"
        >
          {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
          AI 분석 생성
        </button>
      </div>

      {/* AI Report */}
      {aiReport && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-purple-600 to-indigo-700 rounded-2xl p-5 mb-6 text-white shadow-lg"
        >
          <div className="flex items-center gap-2 mb-3">
            <Brain className="w-5 h-5" />
            <h2 className="font-semibold">AI 팀 분석 리포트</h2>
          </div>
          <p className="text-purple-100 text-sm leading-relaxed">{aiReport}</p>
        </motion.div>
      )}

      <div className="grid lg:grid-cols-2 gap-5 mb-5">
        {/* Probability Distribution */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-5 shadow-sm">
          <h2 className="font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <Target className="w-4 h-4 text-blue-500" />
            계약 확률 분포
          </h2>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={probabilityDist}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="range" tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <Tooltip contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', fontSize: '12px' }} />
              <Bar dataKey="count" name="거래처 수" radius={[6, 6, 0, 0]}>
                {probabilityDist.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Weekly Activity */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-5 shadow-sm">
          <h2 className="font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-green-500" />
            주간 신규 거래처
          </h2>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={weeklyActivity}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <Tooltip contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', fontSize: '12px' }} />
              <Line type="monotone" dataKey="count" stroke="#22c55e" strokeWidth={2.5} dot={{ fill: '#22c55e', r: 4 }} name="신규 등록" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Industry breakdown */}
      {industryData.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-5 shadow-sm">
          <h2 className="font-semibold text-slate-900 dark:text-white mb-4">업종별 거래처</h2>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={industryData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <Tooltip contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', fontSize: '12px' }} />
              <Bar dataKey="count" fill="#3b82f6" name="거래처 수" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
