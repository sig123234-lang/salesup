'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { ChevronLeft, ChevronRight, Plus, Clock } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/useAuth'
import { CalendarEvent } from '@/types'
import { cn } from '@/lib/utils'
import { WeeklyCalendarView, getWeekStart } from '@/components/calendar/WeeklyCalendarView'
import { EventDetailPanel } from '@/components/calendar/EventDetailPanel'
import { EVENT_TYPE_COLORS, sourceStyle } from '@/components/calendar/eventStyle'

type ViewMode = 'month' | 'week'

export default function CalendarPage() {
  const { profile } = useAuth()
  const supabase = createClient()
  const searchParams = useSearchParams()

  const [viewMode, setViewMode] = useState<ViewMode>('month')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const [showForm, setShowForm] = useState(() => searchParams.get('new') === '1')
  const [newEvent, setNewEvent] = useState({
    title: '',
    start_at: '',
    end_at: '',
    type: 'VISIT' as CalendarEvent['type'],
  })
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    if (!profile) return
    const currentProfile = profile
    let cancelled = false

    async function fetchEvents() {
      let rangeStart: Date
      let rangeEnd: Date
      if (viewMode === 'month') {
        rangeStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
        rangeEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59)
      } else {
        rangeStart = getWeekStart(currentDate)
        rangeEnd = new Date(rangeStart)
        rangeEnd.setDate(rangeEnd.getDate() + 7)
      }

      const { data } = await supabase
        .from('calendar_events')
        .select('*, client:clients(id, name)')
        .eq('user_id', currentProfile.id)
        .gte('start_at', rangeStart.toISOString())
        .lt('start_at', rangeEnd.toISOString())
        .order('start_at')

      if (cancelled) return
      setEvents((data || []) as CalendarEvent[])
    }

    void fetchEvents()
    return () => {
      cancelled = true
    }
  }, [currentDate, viewMode, profile, supabase, refreshKey])

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  const weeks = useMemo(() => {
    const firstDay = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const arr: (number | null)[][] = []
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
      arr.push(week)
      if (day > daysInMonth) break
    }
    return arr
  }, [year, month])

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
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user || !newEvent.title || !newEvent.start_at) return

    await supabase.from('calendar_events').insert({
      user_id: user.id,
      company_id: profile?.company_id,
      title: newEvent.title,
      start_at: new Date(newEvent.start_at).toISOString(),
      end_at: new Date(newEvent.end_at || newEvent.start_at).toISOString(),
      type: newEvent.type,
      source: 'manual',
    })

    setShowForm(false)
    setNewEvent({ title: '', start_at: '', end_at: '', type: 'VISIT' })
    setRefreshKey((k) => k + 1)
  }

  const selectedEvents = selectedDate ? getEventsForDay(selectedDate.getDate()) : []

  const navigate = (direction: -1 | 1) => {
    if (viewMode === 'month') {
      setCurrentDate(new Date(year, month + direction, 1))
    } else {
      const next = new Date(currentDate)
      next.setDate(next.getDate() + direction * 7)
      setCurrentDate(next)
    }
  }

  const weekStart = useMemo(() => getWeekStart(currentDate), [currentDate])

  const headerLabel = useMemo(() => {
    if (viewMode === 'month') {
      return `${currentDate.getFullYear()}년 ${currentDate.getMonth() + 1}월`
    }
    const ws = weekStart
    const we = new Date(ws)
    we.setDate(we.getDate() + 6)
    return `${ws.getFullYear()}.${ws.getMonth() + 1}.${ws.getDate()} – ${we.getMonth() + 1}.${we.getDate()}`
  }, [viewMode, currentDate, weekStart])

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">캘린더</h1>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <button
              onClick={() => setViewMode('month')}
              className={cn(
                'px-3 py-1.5 text-xs font-medium transition-colors',
                viewMode === 'month'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700',
              )}
            >
              월별
            </button>
            <button
              onClick={() => setViewMode('week')}
              className={cn(
                'px-3 py-1.5 text-xs font-medium transition-colors',
                viewMode === 'week'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700',
              )}
            >
              주별
            </button>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-500 transition-colors"
          >
            <Plus className="w-4 h-4" />
            일정 추가
          </button>
        </div>
      </div>

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

      <div className="flex items-center justify-between px-1 py-2 mb-3">
        <button
          onClick={() => navigate(-1)}
          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
        >
          <ChevronLeft className="w-5 h-5 text-slate-500" />
        </button>
        <h2 className="font-bold text-slate-900 dark:text-white">{headerLabel}</h2>
        <button
          onClick={() => navigate(1)}
          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
        >
          <ChevronRight className="w-5 h-5 text-slate-500" />
        </button>
      </div>

      {viewMode === 'week' ? (
        <WeeklyCalendarView
          weekStart={weekStart}
          events={events}
          onSelect={(e) => setSelectedEvent(e)}
        />
      ) : (
        <div className="grid md:grid-cols-3 gap-5">
          <div className="md:col-span-2 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
            <div className="grid grid-cols-7 border-b border-slate-100 dark:border-slate-700">
              {['일', '월', '화', '수', '목', '금', '토'].map((d, i) => (
                <div
                  key={d}
                  className={cn(
                    'text-center text-xs font-medium py-2',
                    i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-slate-500',
                  )}
                >
                  {d}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7">
              {weeks.flatMap((week, wi) =>
                week.map((d, di) => {
                  if (!d)
                    return (
                      <div
                        key={`e-${wi}-${di}`}
                        className="h-14 md:h-20 border-b border-r border-slate-50 dark:border-slate-700/50"
                      />
                    )
                  const dayEvents = getEventsForDay(d)
                  const sel =
                    selectedDate?.getDate() === d && selectedDate?.getMonth() === month
                  return (
                    <div
                      key={d}
                      onClick={() => handleDayClick(d)}
                      className={cn(
                        'h-14 md:h-20 border-b border-r border-slate-50 dark:border-slate-700/50 p-1 cursor-pointer transition-colors',
                        sel
                          ? 'bg-blue-50 dark:bg-blue-950/30'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-700/30',
                      )}
                    >
                      <div
                        className={cn(
                          'w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium mb-1',
                          isToday(d)
                            ? 'bg-blue-600 text-white'
                            : di === 0
                            ? 'text-red-500'
                            : di === 6
                            ? 'text-blue-500'
                            : 'text-slate-700 dark:text-slate-300',
                        )}
                      >
                        {d}
                      </div>
                      <div className="space-y-0.5">
                        {dayEvents.slice(0, 2).map((e) => {
                          const ss = sourceStyle(e)
                          return (
                            <div
                              key={e.id}
                              onClick={(ev) => {
                                ev.stopPropagation()
                                setSelectedEvent(e)
                              }}
                              className={cn(
                                'text-[10px] px-1.5 py-0.5 rounded text-white truncate',
                                EVENT_TYPE_COLORS[e.type] || 'bg-slate-400',
                                e.is_completed && 'opacity-50',
                                ss?.ringClass,
                              )}
                            >
                              {ss?.icon ?? ''}
                              {ss?.icon ? ' ' : ''}
                              {e.title}
                            </div>
                          )
                        })}
                        {dayEvents.length > 2 && (
                          <div className="text-[10px] text-slate-400 pl-1">
                            +{dayEvents.length - 2}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                }),
              )}
            </div>
          </div>

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
                  {selectedEvents.map((e) => {
                    const ss = sourceStyle(e)
                    return (
                      <button
                        key={e.id}
                        onClick={() => setSelectedEvent(e)}
                        className="w-full text-left p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700"
                      >
                        <div className="flex items-start gap-2">
                          <div
                            className={cn(
                              'w-2 h-2 rounded-full mt-1.5 flex-shrink-0',
                              EVENT_TYPE_COLORS[e.type],
                            )}
                          />
                          <div className="flex-1">
                            <p className="text-sm font-medium text-slate-900 dark:text-white">
                              {ss?.icon ?? ''}
                              {ss?.icon ? ' ' : ''}
                              {e.title}
                            </p>
                            <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {new Date(e.start_at).toLocaleTimeString('ko-KR', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </p>
                            {ss && (
                              <span className="text-[10px] bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-300 px-1.5 py-0.5 rounded mt-1 inline-block">
                                {ss.badge}
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {selectedEvent && (
        <EventDetailPanel
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          onChanged={() => {
            setRefreshKey((k) => k + 1)
            setSelectedEvent(null)
          }}
        />
      )}
    </div>
  )
}
