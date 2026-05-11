'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Brain, TrendingUp, Phone, Navigation, Sparkles,
  RefreshCw, ChevronRight, Target, Clock, X
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/useAuth'
import { AIRecommendation, Client } from '@/types'
import { formatRelativeTime, getProbabilityColor, SALES_STATUS_CONFIG } from '@/lib/utils'
import Link from 'next/link'

type RecommendationItem = AIRecommendation & { client: Client | null }

export default function AIInsightsPage() {
  const { profile } = useAuth()
  const supabase = createClient()

  const [recommendations, setRecommendations] = useState<RecommendationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [stats, setStats] = useState({
    avgProbability: 0,
    highPriorityCount: 0,
    thisWeekContacts: 0,
  })

  async function loadInsights() {
    if (!profile) return
    setLoading(true)
    const { data } = await supabase
      .from('ai_recommendations')
      .select('*, client:clients(*)')
      .eq('user_id', profile!.id)
      .eq('is_dismissed', false)
      .gte('expires_at', new Date().toISOString())
      .order('score', { ascending: false })

    setRecommendations((data || []) as RecommendationItem[])

    // Stats
    const { data: clients } = await supabase
      .from('clients')
      .select('contract_probability')
      .eq('owner_id', profile!.id)

    if (clients && clients.length > 0) {
      const avg = clients.reduce((sum, c) => sum + c.contract_probability, 0) / clients.length
      const high = clients.filter((c) => c.contract_probability >= 70).length
      setStats({ avgProbability: Math.round(avg), highPriorityCount: high, thisWeekContacts: 0 })
    }

    setLoading(false)
  }

  useEffect(() => {
    if (!profile) return
    const currentProfile = profile

    let cancelled = false

    async function fetchInitialInsights() {
      const { data } = await supabase
        .from('ai_recommendations')
        .select('*, client:clients(*)')
        .eq('user_id', currentProfile.id)
        .eq('is_dismissed', false)
        .gte('expires_at', new Date().toISOString())
        .order('score', { ascending: false })

      const { data: clients } = await supabase
        .from('clients')
        .select('contract_probability')
        .eq('owner_id', currentProfile.id)

      if (cancelled) return

      setRecommendations((data || []) as RecommendationItem[])

      if (clients && clients.length > 0) {
        const avg = clients.reduce((sum, client) => sum + client.contract_probability, 0) / clients.length
        const high = clients.filter((client) => client.contract_probability >= 70).length
        setStats({ avgProbability: Math.round(avg), highPriorityCount: high, thisWeekContacts: 0 })
      } else {
        setStats({ avgProbability: 0, highPriorityCount: 0, thisWeekContacts: 0 })
      }
      setLoading(false)
    }

    void fetchInitialInsights()

    return () => {
      cancelled = true
    }
  }, [profile, supabase])

  const generateRecommendations = async () => {
    setGenerating(true)
    try {
      await fetch('/api/ai/recommend', { method: 'POST' })
      await loadInsights()
    } finally {
      setGenerating(false)
    }
  }

  const dismiss = async (id: string) => {
    await supabase.from('ai_recommendations').update({ is_dismissed: true }).eq('id', id)
    setRecommendations((prev) => prev.filter((r) => r.id !== id))
  }

  const getTypeConfig = (type: string) => {
    switch (type) {
      case 'REVISIT': return { icon: Navigation, label: '재방문 추천', color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-950' }
      case 'FOLLOW_UP': return { icon: Phone, label: '팔로업 필요', color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950' }
      case 'UPSELL': return { icon: TrendingUp, label: '업셀 기회', color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-950' }
      case 'RETENTION': return { icon: Target, label: '이탈 방지', color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-950' }
      default: return { icon: Brain, label: '추천', color: 'text-purple-600', bg: 'bg-purple-50' }
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Brain className="w-7 h-7 text-blue-600" />
            AI 인사이트
          </h1>
          <p className="text-sm text-slate-500 mt-1">영업 데이터 기반 AI 분석 및 추천</p>
        </div>
        <motion.button
          onClick={generateRecommendations}
          disabled={generating}
          whileTap={{ scale: 0.95 }}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl text-sm font-medium shadow-lg shadow-blue-500/20 hover:opacity-90 disabled:opacity-50 transition-all"
        >
          <RefreshCw className={`w-4 h-4 ${generating ? 'animate-spin' : ''}`} />
          {generating ? '분석 중...' : 'AI 분석'}
        </motion.button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: '평균 계약 확률', value: `${stats.avgProbability}%`, icon: Target, color: 'text-blue-600' },
          { label: '고확률 거래처', value: `${stats.highPriorityCount}건`, icon: TrendingUp, color: 'text-green-600' },
          { label: 'AI 추천', value: `${recommendations.length}건`, icon: Sparkles, color: 'text-purple-600' },
        ].map((item, i) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-100 dark:border-slate-700 shadow-sm text-center"
          >
            <item.icon className={`w-5 h-5 ${item.color} mx-auto mb-1.5`} />
            <div className="text-xl font-bold text-slate-900 dark:text-white">{item.value}</div>
            <div className="text-xs text-slate-500">{item.label}</div>
          </motion.div>
        ))}
      </div>

      {/* Recommendations */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900 dark:text-white">재방문 추천 목록</h2>
          <span className="text-xs text-slate-400">AI 생성 · 7일 유효</span>
        </div>

        {loading ? (
          <div className="p-6 space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-20 bg-slate-100 dark:bg-slate-700 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : recommendations.length === 0 ? (
          <div className="p-12 text-center">
            <Brain className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">추천이 없습니다</p>
            <p className="text-slate-400 text-sm mt-1">AI 분석 버튼을 눌러 추천을 받아보세요</p>
            <button
              onClick={generateRecommendations}
              disabled={generating}
              className="mt-4 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-500 disabled:opacity-50 transition-colors"
            >
              {generating ? '분석 중...' : 'AI 분석 시작'}
            </button>
          </div>
        ) : (
          <AnimatePresence>
            <div className="divide-y divide-slate-50 dark:divide-slate-700/50">
              {recommendations.map((rec, i) => {
                const typeCfg = getTypeConfig(rec.type)
                const sc = rec.client ? SALES_STATUS_CONFIG[rec.client.sales_status] : null
                const TypeIcon = typeCfg.icon
                return (
                  <motion.div
                    key={rec.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ delay: i * 0.05 }}
                    className="p-4 flex items-start gap-3 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors"
                  >
                    {/* Score Circle */}
                    <div className={`w-12 h-12 rounded-2xl ${typeCfg.bg} flex-shrink-0 flex items-center justify-center`}>
                      <TypeIcon className={`w-5 h-5 ${typeCfg.color}`} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link href={`/clients/${rec.client_id}`}>
                          <h3 className="font-semibold text-slate-900 dark:text-white text-sm hover:text-blue-600 transition-colors">
                            {rec.client?.name}
                          </h3>
                        </Link>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${typeCfg.bg} ${typeCfg.color} font-medium`}>
                          {typeCfg.label}
                        </span>
                        {sc && (
                          <span className={`text-xs px-2 py-0.5 rounded-full ${sc.bg} ${sc.color}`}>
                            {sc.emoji} {sc.label}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">{rec.reason}</p>

                      <div className="flex items-center gap-4 mt-2">
                        <div className="flex items-center gap-1">
                          <div className="h-1.5 w-16 bg-slate-200 dark:bg-slate-600 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${rec.score >= 70 ? 'bg-green-500' : rec.score >= 50 ? 'bg-yellow-500' : 'bg-red-400'}`}
                              style={{ width: `${rec.score}%` }}
                            />
                          </div>
                          <span className={`text-xs font-bold ${getProbabilityColor(rec.score)}`}>{rec.score}점</span>
                        </div>
                        {rec.client?.last_contacted_at && (
                          <span className="text-xs text-slate-400 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatRelativeTime(rec.client.last_contacted_at)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-2 flex-shrink-0">
                      <Link href={`/clients/${rec.client_id}`}>
                        <button className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950 text-blue-600 hover:bg-blue-100 transition-colors">
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </Link>
                      <button
                        onClick={() => dismiss(rec.id)}
                        className="p-2 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </AnimatePresence>
        )}
      </div>
    </div>
  )
}
