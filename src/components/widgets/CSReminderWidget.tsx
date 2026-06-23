'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Bot, Phone, Check, HeartHandshake, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/useAuth'
import type { CalendarEvent } from '@/types'
import { formatRelativeTime } from '@/lib/utils'

type ReminderRow = CalendarEvent & { client?: { id: string; name: string; phone?: string | null } | null }

export function CSReminderWidget() {
  const { profile } = useAuth()
  const supabase = createClient()
  const [reminders, setReminders] = useState<ReminderRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile) return
    const currentProfile = profile
    let cancelled = false

    async function fetchReminders() {
      const horizon = new Date()
      horizon.setDate(horizon.getDate() + 7)

      let query = supabase
        .from('calendar_events')
        .select('*, client:clients(id, name, phone)')
        .eq('user_id', currentProfile.id)
        .eq('is_completed', false)
        .eq('type', 'FOLLOW_UP')
        .lte('start_at', horizon.toISOString())
        .order('start_at', { ascending: true })
        .limit(8)

      // Prefer cs_reminder source if column exists; fall back to is_ai_generated.
      query = query.in('source', ['cs_reminder', 'ai_analysis'])

      const { data, error } = await query
      if (cancelled) return
      if (error) {
        // Likely the source column doesn't exist yet — retry without filter.
        const { data: fallback } = await supabase
          .from('calendar_events')
          .select('*, client:clients(id, name, phone)')
          .eq('user_id', currentProfile.id)
          .eq('is_completed', false)
          .eq('type', 'FOLLOW_UP')
          .eq('is_ai_generated', true)
          .lte('start_at', horizon.toISOString())
          .order('start_at', { ascending: true })
          .limit(8)
        setReminders((fallback || []) as ReminderRow[])
      } else {
        setReminders((data || []) as ReminderRow[])
      }
      setLoading(false)
    }

    void fetchReminders()
    return () => {
      cancelled = true
    }
  }, [profile, supabase])

  const markCompleted = async (id: string) => {
    await supabase.from('calendar_events').update({ is_completed: true }).eq('id', id)
    setReminders((prev) => prev.filter((r) => r.id !== id))
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-100 dark:border-slate-700">
        <h3 className="font-semibold text-slate-900 dark:text-white text-sm flex items-center gap-2">
          <HeartHandshake className="w-4 h-4 text-pink-500" />
          CS 리마인더
          {reminders.length > 0 && (
            <span className="bg-pink-100 dark:bg-pink-950 text-pink-600 text-xs px-1.5 py-0.5 rounded-full">
              {reminders.length}
            </span>
          )}
        </h3>
        <span className="text-[11px] text-slate-400 flex items-center gap-1">
          <Bot className="w-3 h-3" /> AI 자동 생성
        </span>
      </div>

      {loading ? (
        <div className="p-4 space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-14 bg-slate-100 dark:bg-slate-700 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : reminders.length === 0 ? (
        <div className="p-6 text-center text-slate-400 text-sm">
          <HeartHandshake className="w-8 h-8 mx-auto mb-2 opacity-30" />
          ✅ 오늘 CS 연락할 고객이 없어요. 좋은 하루 되세요!
        </div>
      ) : (
        <div className="divide-y divide-slate-50 dark:divide-slate-700/50">
          {reminders.map((r) => (
            <div
              key={r.id}
              className="px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-pink-50 dark:bg-pink-950 flex items-center justify-center flex-shrink-0">
                  <Phone className="w-3.5 h-3.5 text-pink-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <Link
                    href={r.client?.id ? `/clients/${r.client.id}` : '/calendar'}
                    className="text-sm font-medium text-slate-900 dark:text-white truncate block hover:underline"
                  >
                    {r.client?.name || r.title}
                  </Link>
                  <p className="text-xs text-slate-500 mt-0.5 truncate">
                    {r.title} · {formatRelativeTime(r.start_at)}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  {r.client?.phone && (
                    <a
                      href={`tel:${r.client.phone}`}
                      className="px-2 py-1 text-xs bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 rounded-lg flex items-center gap-1"
                    >
                      <Phone className="w-3 h-3" />
                      전화
                    </a>
                  )}
                  <button
                    onClick={() => markCompleted(r.id)}
                    className="px-2 py-1 text-xs bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg flex items-center gap-1 hover:bg-slate-200"
                    aria-label="complete"
                  >
                    <Check className="w-3 h-3" />
                    완료
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {loading && (
        <div className="px-4 py-2 text-xs text-slate-400 flex items-center gap-1">
          <Loader2 className="w-3 h-3 animate-spin" /> 로딩 중...
        </div>
      )}
    </div>
  )
}
