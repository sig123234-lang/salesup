'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Clock, Repeat, Target } from 'lucide-react'
import type { Client } from '@/types'
import { createClient } from '@/lib/supabase/client'

interface FollowupCounterWidgetProps {
  clients: Client[]
  loading: boolean
}

const GOLDEN_HOURS = '오전 10시 ~ 오후 2시'

function daysSince(iso: string | null) {
  if (!iso) return Infinity
  const ms = Date.now() - new Date(iso).getTime()
  return Math.floor(ms / (1000 * 60 * 60 * 24))
}

function reasonText(c: Client, contactCount: number) {
  const d = daysSince(c.last_contacted_at)
  if (!Number.isFinite(d)) return '아직 연락 이력이 없습니다 — 첫 컨택 적기.'
  if (d > 30) return `${d}일간 미연락 — 재방문/재연락 우선.`
  if (contactCount < 5) return `접촉 ${contactCount}회. 5회 임계치까지 더 자주.`
  if (c.contract_probability >= 70) return '계약 확률 70%+ — 빠른 클로징 기회.'
  return '주기적 컨택으로 신뢰 강화.'
}

type SeqInfo = {
  total: number
  completed: number
  nextStartAt: string | null
  daysUntilNext: number | null
}

export function FollowupCounterWidget({ clients, loading }: FollowupCounterWidgetProps) {
  const supabase = createClient()
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [sequences, setSequences] = useState<Record<string, SeqInfo>>({})

  // Top 5 candidates by overdue + probability + days since contact
  const ranked = clients
    .filter((c) => c.sales_status !== 'REJECTED' && c.sales_status !== 'CONTRACTED')
    .map((c) => ({
      client: c,
      score:
        daysSince(c.last_contacted_at) * 1.5 +
        (c.contract_probability ?? 0) * 0.6 +
        (c.next_contact_at && new Date(c.next_contact_at) <= new Date() ? 30 : 0),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((r) => r.client)

  const rankedIdsKey = ranked.map((c) => c.id).join(',')
  useEffect(() => {
    if (!rankedIdsKey) return
    const ids = rankedIdsKey.split(',')
    let cancelled = false
    async function loadCounts() {
      const [activitiesRes, sequencesRes] = await Promise.all([
        supabase
          .from('activities')
          .select('client_id')
          .in('client_id', ids)
          .in('type', ['CALL', 'VISIT']),
        supabase
          .from('calendar_events')
          .select('client_id, start_at, is_completed')
          .in('client_id', ids)
          .eq('source', 'followup_sequence')
          .order('start_at', { ascending: true }),
      ])
      if (cancelled) return

      const nextCounts: Record<string, number> = {}
      for (const row of activitiesRes.data ?? []) {
        const cid = row.client_id as string
        nextCounts[cid] = (nextCounts[cid] ?? 0) + 1
      }
      setCounts(nextCounts)

      const nextSeq: Record<string, SeqInfo> = {}
      const now = new Date()
      for (const row of sequencesRes.data ?? []) {
        const cid = row.client_id as string
        const info = (nextSeq[cid] ??= {
          total: 0,
          completed: 0,
          nextStartAt: null,
          daysUntilNext: null,
        })
        info.total++
        if (row.is_completed) info.completed++
        if (
          !row.is_completed &&
          (!info.nextStartAt || new Date(row.start_at as string) < new Date(info.nextStartAt)) &&
          new Date(row.start_at as string) >= now
        ) {
          info.nextStartAt = row.start_at as string
        }
      }
      const nowMs = now.getTime()
      for (const info of Object.values(nextSeq)) {
        if (info.nextStartAt) {
          info.daysUntilNext = Math.max(
            0,
            Math.ceil((new Date(info.nextStartAt).getTime() - nowMs) / (1000 * 60 * 60 * 24)),
          )
        }
      }
      setSequences(nextSeq)
    }
    void loadCounts()
    return () => {
      cancelled = true
    }
  }, [rankedIdsKey, supabase])

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-100 dark:border-slate-700">
        <h3 className="font-semibold text-slate-900 dark:text-white text-sm flex items-center gap-2">
          <Repeat className="w-4 h-4 text-emerald-500" />
          오늘의 팔로업 TOP 5
        </h3>
        <span className="text-[11px] text-slate-400 flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {GOLDEN_HOURS}
        </span>
      </div>

      {loading ? (
        <div className="p-4 space-y-2">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="h-14 bg-slate-100 dark:bg-slate-700 rounded-xl animate-pulse"
            />
          ))}
        </div>
      ) : ranked.length === 0 ? (
        <div className="p-6 text-center text-slate-400 text-sm">
          <Target className="w-8 h-8 mx-auto mb-2 opacity-30" />
          후속 대상이 없어요
        </div>
      ) : (
        <ol className="divide-y divide-slate-50 dark:divide-slate-700/50">
          {ranked.map((c, idx) => {
            const count = counts[c.id] ?? 0
            const d = daysSince(c.last_contacted_at)
            const seq = sequences[c.id]
            const seqDays = seq?.daysUntilNext ?? null
            return (
              <li key={c.id}>
                <Link
                  href={`/clients/${c.id}`}
                  className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors"
                >
                  <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                      {c.name}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5 truncate">
                      접촉 {count}회 ·{' '}
                      {Number.isFinite(d) ? `${d}일 전 연락` : '연락 이력 없음'}
                      {c.contract_probability != null && ` · ${c.contract_probability}%`}
                    </p>
                    <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-1">
                      💡 {reasonText(c, count)}
                    </p>
                    {seq && seq.total > 0 && (
                      <p className="text-[11px] text-blue-600 dark:text-blue-400 mt-1 flex items-center gap-1">
                        🔄 시퀀스 {seq.completed}/{seq.total}
                        {seqDays != null && ` · 다음 D-${seqDays}`}
                      </p>
                    )}
                  </div>
                </Link>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
