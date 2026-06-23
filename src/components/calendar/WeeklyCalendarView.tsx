'use client'

import { useMemo } from 'react'
import type { CalendarEvent } from '@/types'
import { EVENT_TYPE_COLORS, sourceStyle } from './eventStyle'
import { cn } from '@/lib/utils'

interface WeeklyCalendarViewProps {
  weekStart: Date
  events: CalendarEvent[]
  onSelect: (event: CalendarEvent) => void
}

const KOREAN_DOWS = ['일', '월', '화', '수', '목', '금', '토']
const HOUR_START = 8
const HOUR_END = 21
const HOURS = Array.from({ length: HOUR_END - HOUR_START + 1 }, (_, i) => i + HOUR_START)
const ROW_HEIGHT = 48 // px per hour

function startOfWeek(date: Date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - d.getDay())
  return d
}

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

export function getWeekStart(date: Date) {
  return startOfWeek(date)
}

export function WeeklyCalendarView({ weekStart, events, onSelect }: WeeklyCalendarViewProps) {
  const days = useMemo(() => {
    const start = startOfWeek(weekStart)
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start)
      d.setDate(d.getDate() + i)
      return d
    })
  }, [weekStart])

  const eventsByDay = useMemo(() => {
    const map: CalendarEvent[][] = days.map(() => [])
    for (const e of events) {
      const ed = new Date(e.start_at)
      const idx = days.findIndex((d) => sameDay(d, ed))
      if (idx !== -1) map[idx].push(e)
    }
    for (const list of map) list.sort((a, b) => a.start_at.localeCompare(b.start_at))
    return map
  }, [days, events])

  const today = new Date()
  const gridHeight = HOURS.length * ROW_HEIGHT

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
      {/* Day header row */}
      <div className="grid grid-cols-[3rem_repeat(7,minmax(0,1fr))] border-b border-slate-100 dark:border-slate-700">
        <div />
        {days.map((d, i) => {
          const isToday = sameDay(d, today)
          return (
            <div
              key={d.toISOString()}
              className={cn(
                'py-2 text-center border-l border-slate-100 dark:border-slate-700',
                isToday && 'bg-blue-50/40 dark:bg-blue-950/30',
              )}
            >
              <div
                className={cn(
                  'text-[11px]',
                  i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-slate-500',
                )}
              >
                {KOREAN_DOWS[i]}
              </div>
              <div
                className={cn(
                  'text-sm font-semibold mt-0.5',
                  isToday
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-slate-800 dark:text-slate-200',
                )}
              >
                {d.getDate()}
              </div>
            </div>
          )
        })}
      </div>

      {/* Hour grid: hour-label column + 7 day columns */}
      <div
        className="grid grid-cols-[3rem_repeat(7,minmax(0,1fr))]"
        style={{ height: gridHeight }}
      >
        {/* Hour labels */}
        <div className="relative">
          {HOURS.map((h) => (
            <div
              key={`label-${h}`}
              className="absolute left-0 right-0 text-[10px] text-slate-400 text-right pr-1"
              style={{ top: (h - HOUR_START) * ROW_HEIGHT - 6 }}
            >
              {h > HOUR_START && String(h).padStart(2, '0')}
            </div>
          ))}
        </div>

        {/* Day columns */}
        {days.map((d, di) => (
          <div
            key={`col-${d.toISOString()}`}
            className="relative border-l border-slate-100 dark:border-slate-700/50"
          >
            {/* Hour lines */}
            {HOURS.map((h) => (
              <div
                key={`line-${di}-${h}`}
                className="absolute left-0 right-0 border-t border-slate-100 dark:border-slate-700/40"
                style={{ top: (h - HOUR_START) * ROW_HEIGHT }}
              />
            ))}

            {/* Events */}
            {eventsByDay[di].map((e) => {
              const start = new Date(e.start_at)
              const end = new Date(e.end_at)
              const startHour = start.getHours() + start.getMinutes() / 60
              const endHour = Math.max(startHour + 0.5, end.getHours() + end.getMinutes() / 60)
              const topPx = Math.max(0, (startHour - HOUR_START) * ROW_HEIGHT)
              const heightPx = Math.max(20, (endHour - startHour) * ROW_HEIGHT - 2)
              const style = sourceStyle(e)
              const color = EVENT_TYPE_COLORS[e.type] ?? 'bg-slate-400'
              return (
                <button
                  key={e.id}
                  onClick={() => onSelect(e)}
                  className={cn(
                    'absolute left-1 right-1 rounded-md text-white text-[10px] px-1.5 py-1 text-left shadow-sm hover:opacity-90 transition-opacity overflow-hidden',
                    color,
                    e.is_completed && 'opacity-50 line-through',
                    style?.ringClass,
                  )}
                  style={{ top: topPx, height: heightPx }}
                >
                  <div className="flex items-center gap-0.5 truncate">
                    {style && <span>{style.icon}</span>}
                    <span className="truncate">{e.title}</span>
                  </div>
                  <div className="text-[9px] opacity-80">
                    {start.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </button>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
