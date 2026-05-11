'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle, Plus, Clock, CheckCircle2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/useAuth'
import { Claim } from '@/types'
import { formatDate, cn } from '@/lib/utils'
import Link from 'next/link'

type ClaimListItem = Claim & { client: { name: string } | null }
type ClaimPriority = Claim['priority']

const PRIORITY_CONFIG = {
  LOW: { label: '낮음', color: 'text-slate-500', bg: 'bg-slate-100 dark:bg-slate-700' },
  MEDIUM: { label: '보통', color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950' },
  HIGH: { label: '높음', color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-950' },
  URGENT: { label: '긴급', color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-950' },
}

const STATUS_CONFIG = {
  OPEN: { label: '접수', color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-950' },
  IN_PROGRESS: { label: '처리중', color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950' },
  RESOLVED: { label: '해결됨', color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-950' },
  CLOSED: { label: '종료', color: 'text-slate-500', bg: 'bg-slate-100 dark:bg-slate-700' },
}

export default function ClaimsPage() {
  const { profile } = useAuth()
  const supabase = createClient()

  const [claims, setClaims] = useState<ClaimListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [form, setForm] = useState({
    client_id: '',
    type: 'general',
    description: '',
    priority: 'MEDIUM' as 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT',
  })
  const [clients, setClients] = useState<{ id: string; name: string }[]>([])

  async function loadClaims() {
    if (!profile) return
    let query = supabase
      .from('claims')
      .select('*, client:clients(name)')
      .eq('user_id', profile!.id)
      .order('created_at', { ascending: false })

    if (statusFilter !== 'ALL') {
      query = query.eq('status', statusFilter)
    }

    const { data } = await query
    setClaims((data || []) as ClaimListItem[])
    setLoading(false)
  }

  useEffect(() => {
    if (!profile) return
    const currentProfile = profile

    let cancelled = false

    async function fetchPageData() {
      let claimsQuery = supabase
        .from('claims')
        .select('*, client:clients(name)')
        .eq('user_id', currentProfile.id)
        .order('created_at', { ascending: false })

      if (statusFilter !== 'ALL') {
        claimsQuery = claimsQuery.eq('status', statusFilter)
      }

      const [{ data: claimsData }, { data: clientsData }] = await Promise.all([
        claimsQuery,
        supabase
          .from('clients')
          .select('id, name')
          .eq('owner_id', currentProfile.id)
          .order('name'),
      ])

      if (cancelled) return

      setClaims((claimsData || []) as ClaimListItem[])
      setClients(clientsData || [])
      setLoading(false)
    }

    void fetchPageData()

    return () => {
      cancelled = true
    }
  }, [profile, statusFilter, supabase])

  const createClaim = async (e: React.FormEvent) => {
    e.preventDefault()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !form.client_id) return

    await supabase.from('claims').insert({
      ...form,
      user_id: user.id,
      company_id: profile?.company_id,
      status: 'OPEN',
    })

    setShowForm(false)
    setForm({ client_id: '', type: 'general', description: '', priority: 'MEDIUM' })
    loadClaims()
  }

  const updateStatus = async (claimId: string, status: string) => {
    await supabase.from('claims').update({
      status,
      resolved_at: status === 'RESOLVED' ? new Date().toISOString() : null,
    }).eq('id', claimId)
    loadClaims()
  }

  const CLAIM_TYPES = [
    { value: 'general', label: '일반' },
    { value: 'delivery', label: '배송 지연' },
    { value: 'lost', label: '분실' },
    { value: 'damage', label: '파손' },
    { value: 'quality', label: '품질 불만' },
    { value: 'service', label: '서비스 불만' },
    { value: 'price', label: '가격 문제' },
  ]

  const statusCounts = {
    ALL: claims.length,
    OPEN: claims.filter(c => c.status === 'OPEN').length,
    IN_PROGRESS: claims.filter(c => c.status === 'IN_PROGRESS').length,
    RESOLVED: claims.filter(c => c.status === 'RESOLVED').length,
  }

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">클레임 관리</h1>
          <p className="text-sm text-slate-500">고객 불만 및 문제 처리</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-500 transition-colors"
        >
          <Plus className="w-4 h-4" />
          클레임 등록
        </button>
      </div>

      {/* Status Filter */}
      <div className="flex gap-2 mb-4 overflow-x-auto scrollbar-hide">
        {[
          { key: 'ALL', label: `전체 ${statusCounts.ALL}` },
          { key: 'OPEN', label: `접수 ${statusCounts.OPEN}` },
          { key: 'IN_PROGRESS', label: `처리중 ${statusCounts.IN_PROGRESS}` },
          { key: 'RESOLVED', label: `해결됨 ${statusCounts.RESOLVED}` },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setStatusFilter(key)}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all',
              statusFilter === key
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Create Form */}
      <AnimatePresence>
        {showForm && (
          <motion.form
            onSubmit={createClaim}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-5 mb-5 shadow-sm space-y-3"
          >
            <h2 className="font-semibold text-slate-900 dark:text-white">클레임 등록</h2>

            <select
              required
              value={form.client_id}
              onChange={(e) => setForm(p => ({ ...p, client_id: e.target.value }))}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">거래처 선택 *</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>

            <div className="grid grid-cols-2 gap-3">
              <select
                value={form.type}
                onChange={(e) => setForm(p => ({ ...p, type: e.target.value }))}
                className="px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {CLAIM_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>

              <select
                value={form.priority}
                onChange={(e) => setForm((p) => ({ ...p, priority: e.target.value as ClaimPriority }))}
                className="px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {Object.entries(PRIORITY_CONFIG).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>

            <textarea
              required
              value={form.description}
              onChange={(e) => setForm(p => ({ ...p, description: e.target.value }))}
              placeholder="클레임 내용을 입력하세요..."
              rows={3}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />

            <div className="flex gap-2">
              <button type="submit" className="flex-1 py-3 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-500 transition-colors">
                등록
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-3 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 rounded-xl text-sm transition-colors">
                취소
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {/* Claims List */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-4 space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-20 bg-slate-100 dark:bg-slate-700 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : claims.length === 0 ? (
          <div className="p-10 text-center text-slate-400">
            <AlertTriangle className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">클레임이 없습니다</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50 dark:divide-slate-700/50">
            {claims.map((claim) => {
              const pc = PRIORITY_CONFIG[claim.priority]
              const sc = STATUS_CONFIG[claim.status as keyof typeof STATUS_CONFIG]
              return (
                <motion.div
                  key={claim.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0', pc.bg)}>
                      <AlertTriangle className={cn('w-5 h-5', pc.color)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link href={`/clients/${claim.client_id}`}>
                          <span className="font-semibold text-sm text-slate-900 dark:text-white hover:text-blue-600">
                            {claim.client?.name}
                          </span>
                        </Link>
                        <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', sc.bg, sc.color)}>
                          {sc.label}
                        </span>
                        <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', pc.bg, pc.color)}>
                          {pc.label}
                        </span>
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 leading-relaxed line-clamp-2">
                        {claim.description}
                      </p>
                      <p className="text-xs text-slate-400 mt-1.5 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDate(claim.created_at)}
                      </p>
                    </div>
                  </div>

                  {claim.status !== 'CLOSED' && (
                    <div className="flex gap-2 mt-3 ml-13 pl-13">
                      {claim.status === 'OPEN' && (
                        <button
                          onClick={() => updateStatus(claim.id, 'IN_PROGRESS')}
                          className="text-xs px-3 py-1.5 bg-amber-50 dark:bg-amber-950 text-amber-600 rounded-lg hover:bg-amber-100 transition-colors"
                        >
                          처리 시작
                        </button>
                      )}
                      {claim.status === 'IN_PROGRESS' && (
                        <button
                          onClick={() => updateStatus(claim.id, 'RESOLVED')}
                          className="text-xs px-3 py-1.5 bg-green-50 dark:bg-green-950 text-green-600 rounded-lg hover:bg-green-100 transition-colors flex items-center gap-1"
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          해결 완료
                        </button>
                      )}
                      {claim.status === 'RESOLVED' && (
                        <button
                          onClick={() => updateStatus(claim.id, 'CLOSED')}
                          className="text-xs px-3 py-1.5 bg-slate-100 dark:bg-slate-700 text-slate-500 rounded-lg hover:bg-slate-200 transition-colors"
                        >
                          종료
                        </button>
                      )}
                    </div>
                  )}
                </motion.div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
