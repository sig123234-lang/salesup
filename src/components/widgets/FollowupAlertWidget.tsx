'use client'

import { useEffect, useState } from 'react'
import { Bell, ArrowRight, Phone, Flame, Target } from 'lucide-react'
import Link from 'next/link'
import { Client } from '@/types'
import { createClient } from '@/lib/supabase/client'
import { formatRelativeTime, cn } from '@/lib/utils'

interface FollowupAlertWidgetProps {
  clients: Client[]
  loading: boolean
}

const FOLLOWUP_GOAL = 5 // research: 80% of deals need 5+ follow-ups

function daysSince(iso: string | null) {
  if (!iso) return Infinity
  const ms = Date.now() - new Date(iso).getTime()
  return Math.floor(ms / (1000 * 60 * 60 * 24))
}

function goldenDayBadge() {
  const dow = new Date().getDay() // 0 sun ... 6 sat
  return dow === 2 || dow === 4 // Tue/Thu
}

export function FollowupAlertWidget({ clients, loading }: FollowupAlertWidgetProps) {
  const supabase = createClient()
  const overdue = clients.filter(
    (c) => c.next_contact_at && new Date(c.next_contact_at) <= new Date(),
  )
  const top = overdue.slice(0, 5)

  const [counts, setCounts] = useState<Record<string, number>>({})

  const topIdsKey = top.map((c) => c.id).join(',')
  useEffect(() => {
    if (!topIdsKey) return
    let cancelled = false
    const ids = topIdsKey.split(',')
    async function loadCounts() {
      const { data } = await supabase
        .from('activities')
        .select('client_id')
        .in('client_id', ids)
        .in('type', ['CALL', 'VISIT'])
      if (cancelled || !data) return
      const next: Record<string, number> = {}
      for (const row of data) {
        const cid = row.client_id as string
        next[cid] = (next[cid] ?? 0) + 1
      }
      setCounts(next)
    }
    void loadCounts()
    return () => {
      cancelled = true
    }
  }, [topIdsKey, supabase])

  const isGoldenDay = goldenDayBadge()

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-100 dark:border-slate-700">
        <h3 className="font-semibold text-slate-900 dark:text-white text-sm flex items-center gap-2">
          <Bell className="w-4 h-4 text-amber-500" />
          후속 연락 필요
          {overdue.length > 0 && (
            <span className="bg-red-100 dark:bg-red-950 text-red-600 text-xs px-1.5 py-0.5 rounded-full">
              {overdue.length}
            </span>
          )}
          {isGoldenDay && (
            <span className="flex items-center gap-1 bg-orange-100 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300 text-[10px] px-1.5 py-0.5 rounded-full ml-1">
              <Flame className="w-3 h-3" /> 골든 데이
            </span>
          )}
        </h3>
        <Link
          href="/clients"
          className="text-xs text-blue-600 hover:text-blue-500 flex items-center gap-1"
        >
          전체보기 <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      {loading ? (
        <div className="p-4 space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-12 bg-slate-100 dark:bg-slate-700 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : overdue.length === 0 ? (
        <div className="p-6 text-center text-slate-400 text-sm">
          <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
          모든 후속 연락 완료
        </div>
      ) : (
        <div className="divide-y divide-slate-50 dark:divide-slate-700/50">
          {top.map((client) => {
            const count = counts[client.id] ?? 0
            const remaining = Math.max(0, FOLLOWUP_GOAL - count)
            const progress = Math.min(100, (count / FOLLOWUP_GOAL) * 100)
            const lastContact = daysSince(client.last_contacted_at)
            const lastColor =
              lastContact <= 7
                ? 'text-emerald-600'
                : lastContact <= 21
                  ? 'text-amber-600'
                  : 'text-rose-600'
            return (
              <Link key={client.id} href={`/clients/${client.id}`}>
                <div className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                  <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950 flex items-center justify-center flex-shrink-0">
                    <Phone className="w-3.5 h-3.5 text-amber-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                        {client.name}
                      </p>
                      <span className={cn('text-[11px] font-medium flex-shrink-0', lastColor)}>
                        {Number.isFinite(lastContact)
                          ? `${lastContact}일 전`
                          : '연락 이력 없음'}
                      </span>
                    </div>
                    <p className="text-xs text-red-500 mt-0.5">
                      {client.next_contact_at
                        ? `${formatRelativeTime(client.next_contact_at)} 연락 예정`
                        : '연락 필요'}
                    </p>
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="flex-1 h-1 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                        <div
                          className="h-full bg-blue-500 transition-all"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
                        <Target className="w-3 h-3" />
                        {count}/{FOLLOWUP_GOAL}
                        {remaining > 0 ? ` (-${remaining})` : ' ✅'}
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
