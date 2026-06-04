'use client'

import { Calendar, Clock } from 'lucide-react'
import Link from 'next/link'
import { CalendarEvent } from '@/types'

interface CalendarWidgetProps {
  events: CalendarEvent[]
  loading: boolean
}

export function CalendarWidget({ events, loading }: CalendarWidgetProps) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-100 dark:border-slate-700">
        <h3 className="font-semibold text-slate-900 dark:text-white text-sm flex items-center gap-2">
          <Calendar className="w-4 h-4 text-purple-500" />
          다가오는 일정
        </h3>
        <Link href="/calendar" className="text-xs text-blue-600 hover:text-blue-500">더보기</Link>
      </div>

      {loading ? (
        <div className="p-4 space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-12 bg-slate-100 dark:bg-slate-700 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : events.length === 0 ? (
        <div className="p-6 text-center text-slate-400 text-sm">
          <Calendar className="w-8 h-8 mx-auto mb-2 opacity-30" />
          예정된 일정 없음
        </div>
      ) : (
        <div className="p-3 space-y-2">
          {events.map((event) => (
            <div key={event.id} className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/50">
              <div className="w-2 h-2 rounded-full bg-purple-500 mt-1.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{event.title}</p>
                <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                  <Clock className="w-3 h-3" />
                  {new Date(event.start_at).toLocaleDateString('ko-KR', {
                    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                  })}
                </p>
              </div>
              {event.is_ai_generated && (
                <span className="text-[10px] bg-blue-50 dark:bg-blue-950 text-blue-600 px-1.5 py-0.5 rounded-md flex-shrink-0">AI</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
