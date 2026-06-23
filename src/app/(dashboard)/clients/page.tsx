'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
// useEffect kept for the industry/tag option preload below
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Search,
  Plus,
  Users,
  Phone,
  MapPin,
  ChevronRight,
  Filter,
  RotateCcw,
  X,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/useAuth'
import { Client, SalesStatus } from '@/types'
import { SALES_STATUS_CONFIG, formatRelativeTime, getProbabilityColor, cn } from '@/lib/utils'
import Link from 'next/link'

type SortMode =
  | 'recent_updated'
  | 'probability_desc'
  | 'last_contact_oldest'
  | 'name_asc'

type ContactWindow = 'all' | 'today' | 'this_week' | 'this_month' | 'over_30'

const STATUS_OPTIONS: SalesStatus[] = [
  'NEW_LEAD',
  'FIRST_VISIT',
  'QUOTE_SENT',
  'FOLLOW_UP',
  'CONTRACT_IN_PROGRESS',
  'CONTRACTED',
  'POTENTIAL',
  'REJECTED',
]

const SORT_LABEL: Record<SortMode, string> = {
  recent_updated: '최근 수정순',
  probability_desc: '계약 확률 높은순',
  last_contact_oldest: '마지막 연락 오래된순',
  name_asc: '이름순',
}

const CONTACT_WINDOW_LABEL: Record<ContactWindow, string> = {
  all: '전체',
  today: '오늘',
  this_week: '이번 주',
  this_month: '이번 달',
  over_30: '30일 이상 연락 없음',
}

interface Filters {
  statuses: SalesStatus[]
  minProb: number
  maxProb: number
  industries: string[]
  tags: string[]
  contactWindow: ContactWindow
  sort: SortMode
  q: string
}

function emptyFilters(): Filters {
  return {
    statuses: [],
    minProb: 0,
    maxProb: 100,
    industries: [],
    tags: [],
    contactWindow: 'all',
    sort: 'recent_updated',
    q: '',
  }
}

function parseFromSearchParams(sp: URLSearchParams): Filters {
  const base = emptyFilters()
  const statusParam = sp.get('status')
  if (statusParam) {
    base.statuses = statusParam
      .split(',')
      .map((s) => s.toUpperCase())
      .filter((s) => (STATUS_OPTIONS as string[]).includes(s)) as SalesStatus[]
  }
  base.minProb = Math.max(0, Math.min(100, parseInt(sp.get('min_prob') ?? '0', 10) || 0))
  base.maxProb = Math.max(0, Math.min(100, parseInt(sp.get('max_prob') ?? '100', 10) || 100))
  const ind = sp.get('industries')
  if (ind) base.industries = ind.split(',').filter(Boolean)
  const tg = sp.get('tags')
  if (tg) base.tags = tg.split(',').filter(Boolean)
  const cw = sp.get('contact_window') as ContactWindow | null
  if (cw && cw in CONTACT_WINDOW_LABEL) base.contactWindow = cw
  const s = sp.get('sort') as SortMode | null
  if (s && s in SORT_LABEL) base.sort = s
  base.q = sp.get('q') ?? ''
  return base
}

function filtersToSearchParams(f: Filters): URLSearchParams {
  const p = new URLSearchParams()
  if (f.statuses.length > 0) p.set('status', f.statuses.join(','))
  if (f.minProb > 0) p.set('min_prob', String(f.minProb))
  if (f.maxProb < 100) p.set('max_prob', String(f.maxProb))
  if (f.industries.length > 0) p.set('industries', f.industries.join(','))
  if (f.tags.length > 0) p.set('tags', f.tags.join(','))
  if (f.contactWindow !== 'all') p.set('contact_window', f.contactWindow)
  if (f.sort !== 'recent_updated') p.set('sort', f.sort)
  if (f.q) p.set('q', f.q)
  return p
}

export default function ClientsPage() {
  const router = useRouter()
  const sp = useSearchParams()
  const { profile } = useAuth()
  const supabase = createClient()

  const [filters, setFilters] = useState<Filters>(() => parseFromSearchParams(sp))
  const [clients, setClients] = useState<Client[]>([])
  const [total, setTotal] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [filterOpen, setFilterOpen] = useState(false)

  const [industryOptions, setIndustryOptions] = useState<string[]>([])
  const [tagOptions, setTagOptions] = useState<string[]>([])

  // Pull industry & tag options once profile is available
  useEffect(() => {
    if (!profile) return
    let cancelled = false
    void (async () => {
      let query = supabase.from('clients').select('industry, tags')
      query = profile.company_id
        ? query.or(`owner_id.eq.${profile.id},company_id.eq.${profile.company_id}`)
        : query.eq('owner_id', profile.id)
      const { data } = await query.limit(1000)
      if (cancelled || !data) return
      const indSet = new Set<string>()
      const tagSet = new Set<string>()
      for (const row of data) {
        const industry = row.industry as string | null
        if (industry) indSet.add(industry)
        const tags = (row.tags as string[] | null) ?? []
        for (const t of tags) if (t) tagSet.add(t)
      }
      setIndustryOptions([...indSet].sort())
      setTagOptions([...tagSet].sort())
    })()
    return () => {
      cancelled = true
    }
  }, [profile, supabase])

  const fetchClients = useCallback(
    async (f: Filters, p: number, append: boolean) => {
      setLoading(true)
      const params = filtersToSearchParams(f)
      params.set('page', String(p))
      const res = await fetch(`/api/clients/search?${params}`, { cache: 'no-store' })
      const json = await res.json()
      setLoading(false)
      if (!res.ok) return
      const data = (json.data ?? []) as Client[]
      setClients((prev) => (append ? [...prev, ...data] : data))
      setTotal(json.total ?? 0)
      setHasMore(json.has_more === true)
    },
    [],
  )

  const filtersKey = useMemo(() => JSON.stringify(filters), [filters])
  const [lastFiltersKey, setLastFiltersKey] = useState<string | null>(null)
  if (profile && lastFiltersKey !== filtersKey) {
    setLastFiltersKey(filtersKey)
    setPage(1)
    void fetchClients(filters, 1, false)
    const url = filtersToSearchParams(filters).toString()
    router.replace(url ? `/clients?${url}` : '/clients', { scroll: false })
  }

  const reset = () => setFilters(emptyFilters())

  const activeFilterCount = useMemo(() => {
    let n = 0
    if (filters.statuses.length > 0) n++
    if (filters.minProb > 0 || filters.maxProb < 100) n++
    if (filters.industries.length > 0) n++
    if (filters.tags.length > 0) n++
    if (filters.contactWindow !== 'all') n++
    return n
  }, [filters])

  const loadMore = async () => {
    const next = page + 1
    setPage(next)
    await fetchClients(filters, next, true)
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 md:px-8 pt-6 pb-4 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">거래처</h1>
            <p className="text-sm text-slate-500">
              {total}개 {clients.length < total && `(${clients.length}개 표시)`}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setFilterOpen(true)}
              className={cn(
                'lg:hidden flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium border',
                activeFilterCount > 0
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700',
              )}
            >
              <Filter className="w-4 h-4" />
              필터{activeFilterCount > 0 ? ` ${activeFilterCount}` : ''}
            </button>
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
        </div>

        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={filters.q}
            onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
            placeholder="업체명, 담당자, 전화번호 검색"
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={filters.sort}
            onChange={(e) => setFilters((f) => ({ ...f, sort: e.target.value as SortMode }))}
            className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs rounded-full border-0 focus:outline-none"
          >
            {(Object.keys(SORT_LABEL) as SortMode[]).map((k) => (
              <option key={k} value={k}>
                {SORT_LABEL[k]}
              </option>
            ))}
          </select>
          {activeFilterCount > 0 && (
            <button
              onClick={reset}
              className="flex items-center gap-1 px-2 py-1 text-xs text-slate-500 hover:text-rose-600"
            >
              <RotateCcw className="w-3 h-3" />
              필터 초기화
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 flex">
        <FilterPanel
          className="hidden lg:flex w-72 flex-shrink-0 border-r border-slate-100 dark:border-slate-800 p-5"
          filters={filters}
          setFilters={setFilters}
          industryOptions={industryOptions}
          tagOptions={tagOptions}
          onReset={reset}
        />

        <div className="flex-1 overflow-y-auto px-4 md:px-8 py-4">
          {loading && clients.length === 0 ? (
            <div className="space-y-3">
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className="h-20 bg-white dark:bg-slate-800 rounded-2xl animate-pulse border border-slate-100 dark:border-slate-700"
                />
              ))}
            </div>
          ) : clients.length === 0 ? (
            <div className="text-center py-20">
              <Users className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
              <p className="text-slate-500 dark:text-slate-400 font-medium">
                조건에 맞는 거래처가 없습니다
              </p>
              <button
                onClick={reset}
                className="mt-4 text-sm text-blue-600 hover:text-blue-500"
              >
                필터 초기화
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <AnimatePresence>
                {clients.map((client, i) => {
                  const sc = SALES_STATUS_CONFIG[client.sales_status]
                  const needsFollowUp =
                    client.next_contact_at && new Date(client.next_contact_at) <= new Date()
                  return (
                    <motion.div
                      key={client.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(0.02 * i, 0.4) }}
                      layout
                    >
                      <Link href={`/clients/${client.id}`}>
                        <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl p-4 hover:shadow-md hover:border-blue-100 dark:hover:border-blue-900 transition-all active:scale-[0.99]">
                          <div className="flex items-start gap-3">
                            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-slate-700 dark:to-slate-600 flex items-center justify-center font-bold text-blue-600 dark:text-slate-300 text-base flex-shrink-0">
                              {client.name[0]}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="font-semibold text-slate-900 dark:text-white text-sm">
                                  {client.name}
                                </h3>
                                <span
                                  className={cn(
                                    'text-xs px-2 py-0.5 rounded-full flex-shrink-0',
                                    sc.bg,
                                    sc.color,
                                  )}
                                >
                                  {sc.emoji} {sc.label}
                                </span>
                                {needsFollowUp && (
                                  <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-600 flex-shrink-0 animate-pulse">
                                    📞 연락 필요
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-400 flex-wrap">
                                {client.contact_name && <span>{client.contact_name}</span>}
                                {client.phone && (
                                  <span className="flex items-center gap-1">
                                    <Phone className="w-3 h-3" />
                                    {client.phone}
                                  </span>
                                )}
                                {client.address && (
                                  <span className="flex items-center gap-1 truncate max-w-[150px]">
                                    <MapPin className="w-3 h-3 flex-shrink-0" />
                                    {client.address}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <div
                                className={cn(
                                  'text-base font-bold',
                                  getProbabilityColor(client.contract_probability),
                                )}
                              >
                                {client.contract_probability}%
                              </div>
                              <div className="text-xs text-slate-400 mt-0.5">
                                {formatRelativeTime(client.last_contacted_at)}
                              </div>
                              <ChevronRight className="w-4 h-4 text-slate-300 ml-auto mt-1" />
                            </div>
                          </div>
                          {client.tags && client.tags.length > 0 && (
                            <div className="flex gap-1.5 mt-2.5 ml-14 flex-wrap">
                              {client.tags.slice(0, 3).map((tag) => (
                                <span
                                  key={tag}
                                  className="text-xs bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-full"
                                >
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

              {hasMore && (
                <button
                  onClick={loadMore}
                  disabled={loading}
                  className="block w-full text-center py-3 mt-2 text-sm text-blue-600 hover:text-blue-500 disabled:opacity-50"
                >
                  {loading ? '불러오는 중...' : '더 보기'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {filterOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-50 lg:hidden"
              onClick={() => setFilterOpen(false)}
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 26, stiffness: 320 }}
              className="fixed top-0 right-0 bottom-0 w-full max-w-sm bg-white dark:bg-slate-900 z-50 lg:hidden flex flex-col"
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
                <h2 className="font-semibold text-slate-900 dark:text-white">필터</h2>
                <button
                  onClick={() => setFilterOpen(false)}
                  className="p-1 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <FilterPanel
                className="flex-1 overflow-y-auto p-5"
                filters={filters}
                setFilters={setFilters}
                industryOptions={industryOptions}
                tagOptions={tagOptions}
                onReset={reset}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

function FilterPanel({
  className,
  filters,
  setFilters,
  industryOptions,
  tagOptions,
  onReset,
}: {
  className?: string
  filters: Filters
  setFilters: React.Dispatch<React.SetStateAction<Filters>>
  industryOptions: string[]
  tagOptions: string[]
  onReset: () => void
}) {
  const toggleStatus = (s: SalesStatus) =>
    setFilters((f) => ({
      ...f,
      statuses: f.statuses.includes(s)
        ? f.statuses.filter((x) => x !== s)
        : [...f.statuses, s],
    }))

  const toggleIndustry = (v: string) =>
    setFilters((f) => ({
      ...f,
      industries: f.industries.includes(v)
        ? f.industries.filter((x) => x !== v)
        : [...f.industries, v],
    }))

  const toggleTag = (v: string) =>
    setFilters((f) => ({
      ...f,
      tags: f.tags.includes(v) ? f.tags.filter((x) => x !== v) : [...f.tags, v],
    }))

  return (
    <div className={cn('flex-col space-y-5', className)}>
      <section>
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
          영업 단계
        </h3>
        <div className="flex flex-wrap gap-1.5">
          {STATUS_OPTIONS.map((s) => {
            const cfg = SALES_STATUS_CONFIG[s]
            const active = filters.statuses.includes(s)
            return (
              <button
                key={s}
                onClick={() => toggleStatus(s)}
                className={cn(
                  'px-2.5 py-1 text-xs rounded-full transition-colors',
                  active
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200',
                )}
              >
                {cfg.emoji} {cfg.label}
              </button>
            )
          })}
        </div>
      </section>

      <section>
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
          계약 확률 {filters.minProb}% – {filters.maxProb}%
        </h3>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={0}
            max={100}
            value={filters.minProb}
            onChange={(e) =>
              setFilters((f) => ({
                ...f,
                minProb: Math.min(parseInt(e.target.value, 10), f.maxProb),
              }))
            }
            className="flex-1"
          />
          <input
            type="range"
            min={0}
            max={100}
            value={filters.maxProb}
            onChange={(e) =>
              setFilters((f) => ({
                ...f,
                maxProb: Math.max(parseInt(e.target.value, 10), f.minProb),
              }))
            }
            className="flex-1"
          />
        </div>
      </section>

      <section>
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
          마지막 연락
        </h3>
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(CONTACT_WINDOW_LABEL) as ContactWindow[]).map((w) => {
            const active = filters.contactWindow === w
            return (
              <button
                key={w}
                onClick={() => setFilters((f) => ({ ...f, contactWindow: w }))}
                className={cn(
                  'px-2.5 py-1 text-xs rounded-full',
                  active
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200',
                )}
              >
                {CONTACT_WINDOW_LABEL[w]}
              </button>
            )
          })}
        </div>
      </section>

      {industryOptions.length > 0 && (
        <section>
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
            산업
          </h3>
          <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
            {industryOptions.map((v) => {
              const active = filters.industries.includes(v)
              return (
                <button
                  key={v}
                  onClick={() => toggleIndustry(v)}
                  className={cn(
                    'px-2.5 py-1 text-xs rounded-full',
                    active
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200',
                  )}
                >
                  {v}
                </button>
              )
            })}
          </div>
        </section>
      )}

      {tagOptions.length > 0 && (
        <section>
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
            태그
          </h3>
          <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
            {tagOptions.map((v) => {
              const active = filters.tags.includes(v)
              return (
                <button
                  key={v}
                  onClick={() => toggleTag(v)}
                  className={cn(
                    'px-2.5 py-1 text-xs rounded-full',
                    active
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200',
                  )}
                >
                  #{v}
                </button>
              )
            })}
          </div>
        </section>
      )}

      <button
        onClick={onReset}
        className="flex items-center gap-1 text-sm text-slate-500 hover:text-rose-600"
      >
        <RotateCcw className="w-3.5 h-3.5" />
        모두 초기화
      </button>
    </div>
  )
}
