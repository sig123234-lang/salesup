'use client'

import { Bell, ArrowRight, Phone } from 'lucide-react'
import Link from 'next/link'
import { Client } from '@/types'
import { formatRelativeTime } from '@/lib/utils'

interface FollowupAlertWidgetProps {
  clients: Client[]
  loading: boolean
}

export function FollowupAlertWidget({ clients, loading }: FollowupAlertWidgetProps) {
  const overdue = clients.filter(
    (c) => c.next_contact_at && new Date(c.next_contact_at) <= new Date()
  )

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
        </h3>
        <Link href="/clients" className="text-xs text-blue-600 hover:text-blue-500 flex items-center gap-1">
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
          {overdue.slice(0, 5).map((client) => (
            <Link key={client.id} href={`/clients/${client.id}`}>
              <div className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950 flex items-center justify-center flex-shrink-0">
                  <Phone className="w-3.5 h-3.5 text-amber-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{client.name}</p>
                  <p className="text-xs text-red-500 mt-0.5">
                    {client.next_contact_at
                      ? `${formatRelativeTime(client.next_contact_at)} 연락 예정`
                      : '연락 필요'}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
