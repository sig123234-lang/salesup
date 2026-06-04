'use client'

import { Columns, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { Client, SalesStatus } from '@/types'
import { SALES_STATUS_CONFIG } from '@/lib/utils'

const PREVIEW_COLUMNS: SalesStatus[] = [
  'NEW_LEAD', 'FIRST_VISIT', 'QUOTE_SENT', 'FOLLOW_UP',
  'CONTRACT_IN_PROGRESS', 'CONTRACTED',
]

interface KanbanPreviewWidgetProps {
  clients: Client[]
  loading: boolean
}

export function KanbanPreviewWidget({ clients, loading }: KanbanPreviewWidgetProps) {
  const counts = PREVIEW_COLUMNS.reduce<Record<SalesStatus, number>>((acc, status) => {
    acc[status] = clients.filter((c) => c.sales_status === status).length
    return acc
  }, {} as Record<SalesStatus, number>)

  const total = clients.length || 1

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-100 dark:border-slate-700">
        <h3 className="font-semibold text-slate-900 dark:text-white text-sm flex items-center gap-2">
          <Columns className="w-4 h-4 text-violet-500" />
          영업 파이프라인
        </h3>
        <Link href="/kanban" className="text-xs text-blue-600 hover:text-blue-500 flex items-center gap-1">
          칸반 보기 <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      {loading ? (
        <div className="p-4 space-y-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-8 bg-slate-100 dark:bg-slate-700 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="p-4 space-y-2.5">
          {PREVIEW_COLUMNS.map((status) => {
            const sc = SALES_STATUS_CONFIG[status]
            const count = counts[status] ?? 0
            const pct = Math.round((count / total) * 100)
            return (
              <div key={status} className="flex items-center gap-3">
                <span className="text-xs w-24 text-slate-500 dark:text-slate-400 truncate flex-shrink-0">
                  {sc.emoji} {sc.label}
                </span>
                <div className="flex-1 bg-slate-100 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
                  <div
                    className="h-2 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-xs text-slate-500 dark:text-slate-400 w-5 text-right flex-shrink-0">{count}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
