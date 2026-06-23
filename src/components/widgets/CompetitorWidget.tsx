'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  Cell,
} from 'recharts'
import { Swords, MessageSquare, AlertTriangle, ChevronRight } from 'lucide-react'
import { useAIChatStore } from '@/store'

interface CompetitorStat {
  name: string
  count: number
  win_rate: number
  avg_probability_when_mentioned: number
  related_client_ids: string[]
  win_rate_note?: string
}

interface CompetitorStatsResponse {
  competitors: CompetitorStat[]
  total_calls_with_competitors: number
  total_calls: number
}

function barColor(winRate: number) {
  if (winRate >= 60) return '#10b981'
  if (winRate >= 40) return '#f59e0b'
  return '#ef4444'
}

export function CompetitorWidget() {
  const [data, setData] = useState<CompetitorStatsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<CompetitorStat | null>(null)
  const { open: openChat, addMessage } = useAIChatStore()

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const res = await fetch('/api/stats/competitors', { cache: 'no-store' })
      if (!res.ok) {
        if (!cancelled) setLoading(false)
        return
      }
      const json = await res.json()
      if (cancelled) return
      setData(json.data as CompetitorStatsResponse)
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const askAIAbout = (competitor: CompetitorStat) => {
    openChat()
    addMessage({
      id: `competitor-${competitor.name}-${Date.now()}`,
      role: 'user',
      content: `"${competitor.name}" 경쟁사 대응 전략을 알려줘. 우리 데이터: 언급 ${competitor.count}회, 승률 ${competitor.win_rate}%, 평균 계약 확률 ${competitor.avg_probability_when_mentioned}%. 차별화 포인트와 카운터 메시지 제안해줘.`,
      created_at: new Date().toISOString(),
    })
  }

  const top = data?.competitors.slice(0, 8) ?? []

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-100 dark:border-slate-700">
        <h3 className="font-semibold text-slate-900 dark:text-white text-sm flex items-center gap-2">
          <Swords className="w-4 h-4 text-red-500" />
          경쟁사 현황
          {data && (
            <span className="text-[11px] text-slate-400 font-normal">
              · {data.total_calls_with_competitors}/{data.total_calls} 통화
            </span>
          )}
        </h3>
      </div>

      {loading ? (
        <div className="p-4 space-y-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-8 bg-slate-100 dark:bg-slate-700 rounded animate-pulse" />
          ))}
        </div>
      ) : !data || top.length === 0 ? (
        <div className="p-8 text-center text-sm text-slate-400">
          <Swords className="w-8 h-8 mx-auto mb-2 opacity-30" />
          아직 경쟁사 데이터가 없어요.
          <br />
          통화 분석을 하면 자동으로 수집돼요.
        </div>
      ) : (
        <div className="p-4 space-y-4">
          <div style={{ height: Math.max(140, top.length * 32) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={top}
                layout="vertical"
                margin={{ top: 4, right: 40, bottom: 4, left: 0 }}
              >
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={80}
                  fontSize={11}
                  stroke="#94a3b8"
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(148, 163, 184, 0.08)' }}
                  contentStyle={{
                    borderRadius: 8,
                    border: '1px solid #e2e8f0',
                    fontSize: 12,
                  }}
                  formatter={(value, _name, item) => {
                    const payload = (item?.payload ?? {}) as CompetitorStat
                    return [
                      `${value}회 · 승률 ${payload.win_rate ?? 0}%`,
                      payload.name ?? '',
                    ]
                  }}
                />
                <Bar dataKey="count" radius={[0, 6, 6, 0]} barSize={18}>
                  {top.map((c) => (
                    <Cell key={c.name} fill={barColor(c.win_rate)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <ul className="space-y-1.5">
            {top.map((c) => (
              <li
                key={c.name}
                className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/40 cursor-pointer"
                onClick={() => setSelected(c.name === selected?.name ? null : c)}
              >
                <div
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: barColor(c.win_rate) }}
                />
                <span className="text-sm font-medium text-slate-800 dark:text-slate-200 flex-1 min-w-0 truncate">
                  {c.name}
                </span>
                <span className="text-xs text-slate-500">
                  {c.count}회 · 승률 {c.win_rate}%
                </span>
                {c.win_rate < 40 && (
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                )}
                <ChevronRight
                  className={`w-3.5 h-3.5 text-slate-400 flex-shrink-0 transition-transform ${
                    selected?.name === c.name ? 'rotate-90' : ''
                  }`}
                />
              </li>
            ))}
          </ul>

          {selected && (
            <div className="rounded-xl bg-slate-50 dark:bg-slate-700/40 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  {selected.name}
                </p>
                <button
                  onClick={() => askAIAbout(selected)}
                  className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs rounded-lg flex items-center gap-1"
                >
                  <MessageSquare className="w-3 h-3" />
                  AI에게 대응 전략
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-[10px] text-slate-500">언급</p>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                    {selected.count}회
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500">승률</p>
                  <p
                    className="text-sm font-bold"
                    style={{ color: barColor(selected.win_rate) }}
                  >
                    {selected.win_rate}%
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500">평균 확률</p>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                    {selected.avg_probability_when_mentioned}%
                  </p>
                </div>
              </div>
              {selected.win_rate_note && (
                <p className="text-[11px] text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 rounded-lg px-2 py-1">
                  ⚠️ {selected.win_rate_note}
                </p>
              )}
              {selected.related_client_ids.length > 0 && (
                <div>
                  <p className="text-[11px] text-slate-500 mb-1">관련 거래처</p>
                  <div className="flex flex-wrap gap-1">
                    {selected.related_client_ids.slice(0, 6).map((id) => (
                      <Link
                        key={id}
                        href={`/clients/${id}`}
                        className="px-2 py-0.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded text-[11px] text-slate-700 dark:text-slate-300 hover:bg-slate-100"
                      >
                        {id.slice(0, 8)}…
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
