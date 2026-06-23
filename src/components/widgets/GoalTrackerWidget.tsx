'use client'

import { useEffect, useMemo, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from 'recharts'
import { Target, Save, Pencil, Loader2 } from 'lucide-react'

interface MonthBucket {
  month: string
  label: string
  contracts: number
}

interface MonthlyStats {
  month: string
  contracts: number
  calls: number
  visits: number
  goal: { contracts: number; calls: number; visits: number }
  trend: MonthBucket[]
}

const COLORS = {
  contracts: '#3b82f6',
  calls: '#10b981',
  visits: '#a855f7',
}

export function GoalTrackerWidget() {
  const [stats, setStats] = useState<MonthlyStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState({ contracts: 0, calls: 0, visits: 0 })

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const res = await fetch('/api/stats/monthly', { cache: 'no-store' })
      if (!res.ok) {
        if (!cancelled) setLoading(false)
        return
      }
      const json = await res.json()
      if (cancelled) return
      const data = json.data as MonthlyStats
      setStats(data)
      setDraft(data.goal)
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const trendData = useMemo(() => stats?.trend ?? [], [stats])

  const saveGoal = async () => {
    setSaving(true)
    const res = await fetch('/api/stats/monthly', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(draft),
    })
    if (res.ok && stats) {
      setStats({ ...stats, goal: draft })
    }
    setSaving(false)
    setEditing(false)
  }

  const noGoal = stats && stats.goal.contracts === 0 && stats.goal.calls === 0 && stats.goal.visits === 0

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-100 dark:border-slate-700">
        <h3 className="font-semibold text-slate-900 dark:text-white text-sm flex items-center gap-2">
          <Target className="w-4 h-4 text-blue-500" />
          이번 달 목표
          {stats && (
            <span className="text-xs text-slate-400 font-normal">· {stats.month}</span>
          )}
        </h3>
        {!editing && stats && !noGoal && (
          <button
            onClick={() => setEditing(true)}
            className="text-xs text-slate-500 hover:text-blue-500 flex items-center gap-1"
          >
            <Pencil className="w-3 h-3" />
            목표 수정
          </button>
        )}
      </div>

      {loading || !stats ? (
        <div className="p-6 space-y-3">
          <div className="grid grid-cols-3 gap-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-32 bg-slate-100 dark:bg-slate-700 rounded-xl animate-pulse" />
            ))}
          </div>
        </div>
      ) : noGoal && !editing ? (
        <div className="p-8 text-center">
          <Target className="w-10 h-10 mx-auto mb-3 text-slate-300" />
          <p className="text-sm text-slate-500 mb-3">월간 목표를 설정해보세요</p>
          <button
            onClick={() => setEditing(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-xl"
          >
            목표 설정하기
          </button>
        </div>
      ) : editing ? (
        <div className="p-4 space-y-3">
          <GoalInput
            label="계약 건수"
            value={draft.contracts}
            onChange={(v) => setDraft((d) => ({ ...d, contracts: v }))}
          />
          <GoalInput
            label="통화 건수"
            value={draft.calls}
            onChange={(v) => setDraft((d) => ({ ...d, calls: v }))}
          />
          <GoalInput
            label="방문 건수"
            value={draft.visits}
            onChange={(v) => setDraft((d) => ({ ...d, visits: v }))}
          />
          <div className="flex gap-2 pt-2">
            <button
              onClick={saveGoal}
              disabled={saving}
              className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-xl flex items-center justify-center gap-2 disabled:opacity-40"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              저장
            </button>
            <button
              onClick={() => {
                setDraft(stats.goal)
                setEditing(false)
              }}
              className="px-4 py-2.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-sm rounded-xl"
            >
              취소
            </button>
          </div>
        </div>
      ) : (
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <Gauge
              label="계약"
              value={stats.contracts}
              goal={stats.goal.contracts}
              color={COLORS.contracts}
            />
            <Gauge
              label="통화"
              value={stats.calls}
              goal={stats.goal.calls}
              color={COLORS.calls}
            />
            <Gauge
              label="방문"
              value={stats.visits}
              goal={stats.goal.visits}
              color={COLORS.visits}
            />
          </div>

          <div>
            <p className="text-xs text-slate-400 mb-2">최근 3개월 계약 추이</p>
            <div className="h-32">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trendData} margin={{ top: 5, right: 0, bottom: 0, left: -25 }}>
                  <XAxis dataKey="label" fontSize={11} stroke="#94a3b8" tickLine={false} axisLine={false} />
                  <YAxis fontSize={11} stroke="#94a3b8" tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 8,
                      border: '1px solid #e2e8f0',
                      fontSize: 12,
                    }}
                    labelStyle={{ fontSize: 11 }}
                  />
                  <Bar dataKey="contracts" radius={[6, 6, 0, 0]}>
                    {trendData.map((d, i) => (
                      <Cell
                        key={d.month}
                        fill={i === trendData.length - 1 ? COLORS.contracts : '#cbd5e1'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Gauge({
  label,
  value,
  goal,
  color,
}: {
  label: string
  value: number
  goal: number
  color: string
}) {
  const pct = goal > 0 ? Math.min(100, Math.round((value / goal) * 100)) : 0
  const radius = 32
  const circ = 2 * Math.PI * radius
  const offset = circ - (pct / 100) * circ
  return (
    <div className="text-center">
      <div className="relative w-20 h-20 mx-auto">
        <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
          <circle cx="40" cy="40" r={radius} stroke="#e2e8f0" strokeWidth="6" fill="none" />
          <circle
            cx="40"
            cy="40"
            r={radius}
            stroke={color}
            strokeWidth="6"
            fill="none"
            strokeDasharray={circ}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.6s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-base font-bold text-slate-900 dark:text-white">{pct}%</span>
        </div>
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">{label}</p>
      <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
        {value} / {goal}
      </p>
    </div>
  )
}

function GoalInput({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (n: number) => void
}) {
  return (
    <div className="flex items-center gap-3">
      <label className="text-sm text-slate-600 dark:text-slate-400 w-20 flex-shrink-0">
        {label}
      </label>
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => onChange(Math.max(0, parseInt(e.target.value || '0', 10)))}
        className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  )
}
