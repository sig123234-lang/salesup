'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Plus, Users, Phone, MapPin, ChevronRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/useAuth'
import { Client, SalesStatus } from '@/types'
import { SALES_STATUS_CONFIG, formatRelativeTime, getProbabilityColor, cn } from '@/lib/utils'
import Link from 'next/link'

const STATUS_FILTERS: { value: SalesStatus | 'ALL'; label: string }[] = [
  { value: 'ALL', label: '전체' },
  { value: 'NEW_LEAD', label: '신규 리드' },
  { value: 'FIRST_VISIT', label: '첫 방문' },
  { value: 'QUOTE_SENT', label: '견적 전달' },
  { value: 'FOLLOW_UP', label: '연락 예정' },
  { value: 'CONTRACT_IN_PROGRESS', label: '진행중' },
  { value: 'CONTRACTED', label: '계약 완료' },
  { value: 'POTENTIAL', label: '잠재 고객' },
  { value: 'REJECTED', label: '거절' },
]

export default function ClientsPage() {
  const { profile } = useAuth()
  const supabase = createClient()

  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<SalesStatus | 'ALL'>('ALL')

  useEffect(() => {
    if (!profile) return
    const currentProfile = profile

    let cancelled = false

    async function fetchClients() {
      let query = supabase
        .from('clients')
        .select('*')
        .order('updated_at', { ascending: false })

      if (currentProfile.company_id) {
        query = query.or(`owner_id.eq.${currentProfile.id},company_id.eq.${currentProfile.company_id}`)
      } else {
        query = query.eq('owner_id', currentProfile.id)
      }

      if (statusFilter !== 'ALL') {
        query = query.eq('sales_status', statusFilter)
      }

      const { data } = await query
      if (cancelled) return

      setClients((data || []) as Client[])
      setLoading(false)
    }

    void fetchClients()

    return () => {
      cancelled = true
    }
  }, [profile, statusFilter, supabase])

  const filtered = clients.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.contact_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (c.phone ?? '').includes(search)
  )

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 md:px-8 pt-6 pb-4 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">거래처</h1>
            <p className="text-sm text-slate-500">{filtered.length}개</p>
          </div>
          <Link href="/clients/new">
            <motion.button
              whileTap={{ scale: 0.95 }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl font-medium text-sm shadow-lg shadow-blue-500/20 hover:bg-blue-500 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">거래처 추가</span>
            </motion.button>
          </Link>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="업체명, 담당자, 전화번호 검색"
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Status filter chips */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {STATUS_FILTERS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => {
                setLoading(true)
                setStatusFilter(value)
              }}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all',
                statusFilter === value
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              )}
            >
              {value !== 'ALL' && SALES_STATUS_CONFIG[value as SalesStatus]?.emoji + ' '}
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Client List */}
      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-4">
        {loading ? (
          <div className="space-y-3">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-20 bg-white dark:bg-slate-800 rounded-2xl animate-pulse border border-slate-100 dark:border-slate-700" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <Users className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <p className="text-slate-500 dark:text-slate-400 font-medium">거래처가 없습니다</p>
            <p className="text-slate-400 dark:text-slate-500 text-sm mt-1">새 거래처를 추가해보세요</p>
            <Link href="/clients/new">
              <button className="mt-4 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-500 transition-colors">
                거래처 추가
              </button>
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            <AnimatePresence>
              {filtered.map((client, i) => {
                const sc = SALES_STATUS_CONFIG[client.sales_status]
                const needsFollowUp = client.next_contact_at && new Date(client.next_contact_at) <= new Date()
                return (
                  <motion.div
                    key={client.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.02 }}
                    layout
                  >
                    <Link href={`/clients/${client.id}`}>
                      <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl p-4 hover:shadow-md hover:border-blue-100 dark:hover:border-blue-900 transition-all active:scale-[0.99]">
                        <div className="flex items-start gap-3">
                          {/* Avatar */}
                          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-slate-700 dark:to-slate-600 flex items-center justify-center font-bold text-blue-600 dark:text-slate-300 text-base flex-shrink-0">
                            {client.name[0]}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-semibold text-slate-900 dark:text-white text-sm">{client.name}</h3>
                              <span className={cn('text-xs px-2 py-0.5 rounded-full flex-shrink-0', sc.bg, sc.color)}>
                                {sc.emoji} {sc.label}
                              </span>
                              {needsFollowUp && (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-600 flex-shrink-0 animate-pulse">
                                  📞 연락 필요
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-400 flex-wrap">
                              {client.contact_name && (
                                <span>{client.contact_name}</span>
                              )}
                              {client.phone && (
                                <span className="flex items-center gap-1">
                                  <Phone className="w-3 h-3" />{client.phone}
                                </span>
                              )}
                              {client.address && (
                                <span className="flex items-center gap-1 truncate max-w-[150px]">
                                  <MapPin className="w-3 h-3 flex-shrink-0" />{client.address}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="text-right flex-shrink-0">
                            <div className={cn('text-base font-bold', getProbabilityColor(client.contract_probability))}>
                              {client.contract_probability}%
                            </div>
                            <div className="text-xs text-slate-400 mt-0.5">{formatRelativeTime(client.last_contacted_at)}</div>
                            <ChevronRight className="w-4 h-4 text-slate-300 ml-auto mt-1" />
                          </div>
                        </div>

                        {/* Tags */}
                        {client.tags && client.tags.length > 0 && (
                          <div className="flex gap-1.5 mt-2.5 ml-14 flex-wrap">
                            {client.tags.slice(0, 3).map((tag) => (
                              <span key={tag} className="text-xs bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-full">
                                #{tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </Link>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  )
}
