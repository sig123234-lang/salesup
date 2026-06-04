'use client'

import { Users, Phone, ArrowRight } from 'lucide-react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { Client } from '@/types'
import { SALES_STATUS_CONFIG, getProbabilityColor, formatRelativeTime } from '@/lib/utils'

interface RecentClientsWidgetProps {
  clients: Client[]
  loading: boolean
}

export function RecentClientsWidget({ clients, loading }: RecentClientsWidgetProps) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-700">
        <h2 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
          <Users className="w-4 h-4 text-blue-500" />
          최근 거래처
        </h2>
        <Link href="/clients" className="text-sm text-blue-600 hover:text-blue-500 flex items-center gap-1">
          전체보기 <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      {loading ? (
        <div className="p-5 space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-14 bg-slate-100 dark:bg-slate-700 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : clients.length === 0 ? (
        <div className="p-10 text-center text-slate-400">
          <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">거래처를 추가해보세요</p>
        </div>
      ) : (
        <div className="divide-y divide-slate-50 dark:divide-slate-700/50">
          {clients.map((client) => {
            const sc = SALES_STATUS_CONFIG[client.sales_status]
            return (
              <Link key={client.id} href={`/clients/${client.id}`}>
                <motion.div
                  whileHover={{ x: 2 }}
                  className="flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                >
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-600 flex items-center justify-center text-slate-600 dark:text-slate-300 font-bold text-sm flex-shrink-0">
                    {client.name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-slate-900 dark:text-white text-sm truncate">{client.name}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${sc.bg} ${sc.color} flex-shrink-0`}>
                        {sc.emoji} {sc.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      {client.phone && (
                        <span className="text-xs text-slate-400 flex items-center gap-1">
                          <Phone className="w-3 h-3" />{client.phone}
                        </span>
                      )}
                      <span className="text-xs text-slate-400">{formatRelativeTime(client.updated_at)}</span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className={`text-sm font-bold ${getProbabilityColor(client.contract_probability)}`}>
                      {client.contract_probability}%
                    </div>
                    <div className="text-xs text-slate-400">계약확률</div>
                  </div>
                </motion.div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
