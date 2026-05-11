'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { ChevronLeft, ChevronRight, Plus, Clock } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/useAuth'
import { CalendarEvent } from '@/types'
import { cn } from '@/lib/utils'

const EVENT_TYPE_COLORS = {
  CALL: 'bg-blue-500',
  VISIT: 'bg-green-500',
  MEETING: 'bg-purple-500',
  FOLLOW_UP: 'bg-amber-500',
  OTHER: 'bg-slate-400',
}

export default function CalendarPage() {
  const { profile } = useAuth()
  const supabase = createClient()
  const searchParams = useSearchParams()

  const [currentDate, setCurrentDate] = useState(new Date())
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [showForm, setShowForm] = useState(() => searchParams.get('new') === '1')
  const [newEvent, setNewEvent] = useState({ title: '', start_at: '', end_at: '', type: 'VISIT' as const })

  async function loadEvents() {
    if (!profile) return
    const start = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
    const end = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0)

    const { data } = await supabase
      .from('calendar_events')
      .select('*, client:clients(name)')
      .eq('user_id', profile!.id)
      .gte('start_at', start.toISOString())
      .lte('start_at', end.toISOString())
      .order('start_at')

    setEvents((data || []) as CalendarEvent[])
  }

  useEffect(() => {
    if (!profile) return
    const currentProfile = profile

    let cancelled = false

    async function fetchEvents() {
      const start = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
      const end = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0)

      const { data } = await supabase
        .from('calendar_events')
        .select('*, client:clients(name)')
        .eq('user_id', currentProfile.id)
        .gte('start_at', start.toISOString())
        .lte('start_at', end.toISOString())
        .order('start_at')

      if (cancelled) return
      setEvents((data || []) as CalendarEvent[])
    }

    void fetchEvents()

    return () => {
      cancelled = true
    }
  }, [currentDate, profile, supabase])

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const weeks: (number | null)[][] = []
  let day = 1
  for (let w = 0; w < 6; w++) {
    const week: (number | null)[] = []
    for (let d = 0; d < 7; d++) {
      if ((w === 0 && d < firstDay) || day > daysInMonth) {
        week.push(null)
      } else {
        week.push(day++)
      }
    }
    weeks.push(week)
    if (day > daysInMonth) break
  }

  const getEventsForDay = (d: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    return events.filter((e) => e.start_at.startsWith(dateStr))
  }

  const today = new Date()
  const isToday = (d: number) =>
    d === today.getDate() && month === today.getMonth() && year === today.getFullYear()

  const handleDayClick = (d: number) => {
    const date = new Date(year, month, d)
    setSelectedDate(date)
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    setNewEvent((prev) => ({
      ...prev,
      start_at: `${dateStr}T09:00`,
      end_at: `${dateStr}T10:00`,
    }))
  }

  const createEvent = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !newEvent.title || !newEvent.start_at) return

    await supabase.from('calendar_events').insert({
      user_id: user.id,
      company_id: profile?.company_id,
      title: newEvent.title,
      start_at: new Date(newEvent.start_at).toISOString(),
      end_at: new Date(newEvent.end_at || newEvent.start_at).toISOString(),
      type: newEvent.type,
    })

    setShowForm(false)
    setNewEvent({ title: '', start_at: '', end_at: '', type: 'VISIT' })
    void loadEvents()
  }

  const selectedEvents = selectedDate ? getEventsForDay(selectedDate.getDate()) : []

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">캘린더</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-500 transition-colors"
        >
          <Plus className="w-4 h-4" />
          일정 추가
        </button>
      </div>

      {/* Add Event Form */}
      {showForm && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-5 mb-5 shadow-sm"
        >
          <div className="grid grid-cols-2 gap-3 mb-3">
            <input
              type="text"
              placeholder="일정 제목"
              value={newEvent.title}
              onChange={(e) => setNewEvent((p) => ({ ...p, title: e.target.value }))}
              className="col-span-2 px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="datetime-local"
              value={newEvent.start_at}
              onChange={(e) => setNewEvent((p) => ({ ...p, start_at: e.target.value }))}
              className="px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="datetime-local"
              value={newEvent.end_at}
              onChange={(e) => setNewEvent((p) => ({ ...p, end_at: e.target.value }))}
              className="px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={createEvent}
              className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-500 transition-colors"
            >
              저장
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 rounded-xl text-sm hover:bg-slate-200 transition-colors"
            >
              취소
            </button>
          </div>
        </motion.div>
      )}

      <div className="grid md:grid-cols-3 gap-5">
        {/* Calendar Grid */}
        <div className="md:col-span-2 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
          {/* Month nav */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-700">
            <button
              onClick={() => setCurrentDate(new Date(year, month - 1, 1))}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-slate-500" />
            </button>
            <h2 className="font-bold text-slate-900 dark:text-white">
              {year}년 {month + 1}월
            </h2>
            <button
              onClick={() => setCurrentDate(new Date(year, month + 1, 1))}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              <ChevronRight className="w-5 h-5 text-slate-500" />
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-slate-100 dark:border-slate-700">
            {['일', '월', '화', '수', '목', '금', '토'].map((d, i) => (
              <div key={d} className={cn(
                'text-center text-xs font-medium py-2',
                i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-slate-500'
              )}>
                {d}
              </div>
            ))}
          </div>

          {/* Calendar cells */}
          <div className="grid grid-cols-7">
            {weeks.flatMap((week, wi) =>
              week.map((d, di) => {
                if (!d) return <div key={`e-${wi}-${di}`} className="h-14 md:h-20 border-b border-r border-slate-50 dark:border-slate-700/50" />
                const dayEvents = getEventsForDay(d)
                const sel = selectedDate?.getDate() === d && selectedDate?.getMonth() === month
                return (
                  <div
                    key={d}
                    onClick={() => handleDayClick(d)}
                    className={cn(
                      'h-14 md:h-20 border-b border-r border-slate-50 dark:border-slate-700/50 p-1 cursor-pointer transition-colors',
                      sel ? 'bg-blue-50 dark:bg-blue-950/30' : 'hover:bg-slate-50 dark:hover:bg-slate-700/30'
                    )}
                  >
                    <div className={cn(
                      'w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium mb-1',
                      isToday(d) ? 'bg-blue-600 text-white' :
                        di === 0 ? 'text-red-500' : di === 6 ? 'text-blue-500' : 'text-slate-700 dark:text-slate-300'
                    )}>
                      {d}
                    </div>
                    <div className="space-y-0.5">
                      {dayEvents.slice(0, 2).map((e) => (
                        <div key={e.id} className={cn(
                          'text-[10px] px-1.5 py-0.5 rounded text-white truncate',
                          EVENT_TYPE_COLORS[e.type] || 'bg-slate-400'
                        )}>
                          {e.is_ai_generated && '⚡'}{e.title}
                        </div>
                      ))}
                      {dayEvents.length > 2 && (
                        <div className="text-[10px] text-slate-400 pl-1">+{dayEvents.length - 2}</div>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Selected Day Events */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
          <div className="px-4 py-4 border-b border-slate-100 dark:border-slate-700">
            <h3 className="font-semibold text-slate-900 dark:text-white text-sm">
              {selectedDate
                ? `${month + 1}월 ${selectedDate.getDate()}일`
                : '날짜를 선택하세요'}
            </h3>
          </div>
          <div className="p-3">
            {selectedEvents.length === 0 ? (
              <p className="text-center text-slate-400 text-sm py-8">일정 없음</p>
            ) : (
              <div className="space-y-2">
                {selectedEvents.map((e) => (
                  <div key={e.id} className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
                    <div className="flex items-start gap-2">
                      <div className={cn('w-2 h-2 rounded-full mt-1.5 flex-shrink-0', EVENT_TYPE_COLORS[e.type])} />
                      <div>
                        <p className="text-sm font-medium text-slate-900 dark:text-white">{e.title}</p>
                        <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(e.start_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                        {e.is_ai_generated && (
                          <span className="text-[10px] bg-blue-50 dark:bg-blue-950 text-blue-600 px-1.5 py-0.5 rounded mt-1 inline-block">
                            ⚡ AI 생성
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
