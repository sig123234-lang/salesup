'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Sparkles, RefreshCw, ChevronRight, Phone, AlertCircle, TrendingUp, Loader2 } from 'lucide-react'

interface BriefAction {
  priority: number
  icon: string
  title: string
  reason: string
  action: string
  client_id: string | null
}

interface BriefStats {
  scheduled_calls: number
  overdue_followups: number
  high_prob_clients: number
}

interface DailyBrief {
  greeting: string
  top_actions: BriefAction[]
  today_stats: BriefStats
  motivation: string
}

type FallbackKind = 'none' | 'stale_cache' | 'rule_based'

interface BriefPayload {
  brief: DailyBrief | null
  fallback: FallbackKind
  staleDate: string | null
}

async function fetchBrief(force = false): Promise<BriefPayload> {
  const res = await fetch(`/api/ai/daily-brief${force ? '?force=1' : ''}`, {
    method: 'GET',
    cache: 'no-store',
  })
  if (!res.ok) return { brief: null, fallback: 'none', staleDate: null }
  const json = await res.json()
  return {
    brief: (json.data as DailyBrief) ?? null,
    fallback: (json.fallback as FallbackKind) ?? 'none',
    staleDate: (json.stale_cache_date as string | null) ?? null,
  }
}

export function DailyBriefWidget() {
  const [brief, setBrief] = useState<DailyBrief | null>(null)
  const [fallback, setFallback] = useState<FallbackKind>('none')
  const [staleDate, setStaleDate] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const payload = await fetchBrief(false)
      if (!cancelled) {
        setBrief(payload.brief)
        setFallback(payload.fallback)
        setStaleDate(payload.staleDate)
        setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const refresh = async () => {
    setRefreshing(true)
    const payload = await fetchBrief(true)
    setBrief(payload.brief)
    setFallback(payload.fallback)
    setStaleDate(payload.staleDate)
    setRefreshing(false)
  }

  return (
    <div className="bg-gradient-to-br from-indigo-50 via-white to-blue-50 dark:from-slate-800 dark:via-slate-800 dark:to-slate-800 rounded-2xl shadow-sm border border-indigo-100 dark:border-slate-700 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-indigo-100/60 dark:border-slate-700">
        <h3 className="font-semibold text-slate-900 dark:text-white text-sm flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-indigo-500" />
          오늘의 AI 브리핑
        </h3>
        <button
          onClick={refresh}
          disabled={loading || refreshing}
          className="p-1.5 text-slate-400 hover:text-indigo-500 disabled:opacity-40 transition-colors"
          aria-label="새로고침"
        >
          {refreshing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
        </button>
      </div>

      {loading ? (
        <div className="p-4 space-y-3">
          <div className="h-5 w-2/3 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-20 bg-slate-100 dark:bg-slate-700/60 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : !brief ? (
        <div className="p-6 text-center text-slate-400 text-sm">
          AI 브리핑을 불러오지 못했어요.
          <button
            onClick={refresh}
            className="block mt-2 mx-auto text-indigo-600 hover:text-indigo-500 underline"
          >
            다시 시도
          </button>
        </div>
      ) : (
        <div className="p-4 space-y-3">
          {fallback !== 'none' && (
            <p className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
              {fallback === 'stale_cache'
                ? `⚠️ AI 연결 불안정 — ${staleDate ?? '이전'} 캐시된 데이터`
                : '⚠️ AI 연결 불안정 — 규칙 기반 추천'}
            </p>
          )}
          {brief.greeting && (
            <p className="text-sm font-medium text-slate-800 dark:text-slate-200 leading-relaxed">
              {brief.greeting}
            </p>
          )}

          {brief.top_actions.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-4">
              오늘 우선 처리할 액션이 없어요. 신규 리서치에 집중해보세요!
            </p>
          ) : (
            <ol className="space-y-2">
              {brief.top_actions.map((a) => (
                <li
                  key={a.priority}
                  className="bg-white dark:bg-slate-800/80 rounded-xl border border-slate-100 dark:border-slate-700 p-3 flex items-start gap-3"
                >
                  <div className="text-xl flex-shrink-0 leading-none mt-0.5">{a.icon}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                      {a.priority}. {a.title}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                      {a.reason}
                    </p>
                    <p className="text-xs text-indigo-700 dark:text-indigo-300 mt-1.5">
                      → {a.action}
                    </p>
                  </div>
                  {a.client_id && (
                    <Link
                      href={`/clients/${a.client_id}`}
                      className="flex-shrink-0 self-center px-2 py-1 text-xs bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 rounded-lg flex items-center gap-1 hover:bg-indigo-100"
                    >
                      바로가기
                      <ChevronRight className="w-3 h-3" />
                    </Link>
                  )}
                </li>
              ))}
            </ol>
          )}

          <div className="grid grid-cols-3 gap-2 pt-2">
            <StatPill
              icon={<Phone className="w-3 h-3" />}
              label="오늘 일정"
              value={brief.today_stats.scheduled_calls}
              tone="blue"
            />
            <StatPill
              icon={<AlertCircle className="w-3 h-3" />}
              label="기한 초과"
              value={brief.today_stats.overdue_followups}
              tone="amber"
            />
            <StatPill
              icon={<TrendingUp className="w-3 h-3" />}
              label="고확률"
              value={brief.today_stats.high_prob_clients}
              tone="emerald"
            />
          </div>

          {brief.motivation && (
            <p className="text-xs text-indigo-600 dark:text-indigo-300 italic text-center pt-1">
              💪 {brief.motivation}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function StatPill({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode
  label: string
  value: number
  tone: 'blue' | 'amber' | 'emerald'
}) {
  const colors = {
    blue: 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300',
    amber: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300',
    emerald: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300',
  }[tone]
  return (
    <div className={`${colors} rounded-lg px-2 py-2 text-center`}>
      <div className="flex items-center justify-center gap-1 text-[10px] opacity-80">
        {icon}
        {label}
      </div>
      <div className="text-lg font-bold leading-none mt-1">{value}</div>
    </div>
  )
}
