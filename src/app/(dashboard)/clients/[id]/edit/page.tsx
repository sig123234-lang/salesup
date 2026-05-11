'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { ArrowLeft, Save, Camera, Loader2, MapPin } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/useAuth'
import type { Client, SalesStatus } from '@/types'
import { cn, SALES_STATUS_CONFIG as SC } from '@/lib/utils'

const INDUSTRIES = [
  { value: 'laundry', label: '🧺 세탁업' },
  { value: 'retail', label: '🛒 소매업' },
  { value: 'food', label: '🍽️ 음식업' },
  { value: 'insurance', label: '🛡️ 보험' },
  { value: 'real_estate', label: '🏠 부동산' },
  { value: 'advertising', label: '📢 광고대행' },
  { value: 'distribution', label: '🚚 유통' },
  { value: 'general', label: '⚡ 기타' },
]

export default function EditClientPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { profile } = useAuth()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [clientExists, setClientExists] = useState(true)
  const [initialStatus, setInitialStatus] = useState<SalesStatus>('NEW_LEAD')

  const [form, setForm] = useState({
    name: '',
    industry: 'general',
    address: '',
    contact_name: '',
    phone: '',
    email: '',
    memo: '',
    sales_status: 'NEW_LEAD' as SalesStatus,
    tags: '',
  })

  const update = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }))

  useEffect(() => {
    let cancelled = false

    async function fetchClient() {
      const { data } = await supabase.from('clients').select('*').eq('id', id).single()

      if (cancelled) return

      if (!data) {
        setClientExists(false)
        setLoading(false)
        return
      }

      const client = data as Client
      setInitialStatus(client.sales_status)
      setForm({
        name: client.name,
        industry: client.industry || 'general',
        address: client.address || '',
        contact_name: client.contact_name || '',
        phone: client.phone || '',
        email: client.email || '',
        memo: client.memo || '',
        sales_status: client.sales_status,
        tags: (client.tags || []).join(', '),
      })
      setLoading(false)
    }

    void fetchClient()

    return () => {
      cancelled = true
    }
  }, [id, supabase])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile) return
    setSaving(true)

    const tags = form.tags
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean)

    const { data, error } = await supabase
      .from('clients')
      .update({
        ...form,
        tags,
      })
      .eq('id', id)
      .select()
      .single()

    if (!data) {
      console.error(error)
      setSaving(false)
      return
    }

    if (initialStatus !== form.sales_status) {
      const fromStatus = SC[initialStatus]
      const toStatus = SC[form.sales_status]
      await supabase.from('activities').insert({
        client_id: id,
        user_id: profile.id,
        type: 'STATUS_CHANGE',
        content: `영업 상태가 '${fromStatus.label}'에서 '${toStatus.label}'(으)로 변경되었습니다.`,
        metadata: { from: initialStatus, to: form.sales_status },
      })
    }

    router.push(`/clients/${id}`)
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto p-4 md:p-6">
        <div className="space-y-4 animate-pulse">
          <div className="h-14 bg-slate-100 dark:bg-slate-800 rounded-2xl" />
          <div className="h-64 bg-slate-100 dark:bg-slate-800 rounded-2xl" />
          <div className="h-56 bg-slate-100 dark:bg-slate-800 rounded-2xl" />
        </div>
      </div>
    )
  }

  if (!clientExists) {
    return (
      <div className="p-8 text-center text-slate-500">
        <p>거래처를 찾을 수 없습니다.</p>
        <button onClick={() => router.back()} className="mt-4 text-blue-600">
          돌아가기
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="sticky top-0 z-10 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-100 dark:border-slate-800 px-4 md:px-6 py-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800">
          <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
        </button>
        <h1 className="font-semibold text-slate-900 dark:text-white flex-1">거래처 수정</h1>
        <button
          form="client-form"
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-500 disabled:opacity-50 transition-all"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          저장
        </button>
      </div>

      <form id="client-form" onSubmit={handleSubmit} className="p-4 md:p-6 space-y-5">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-5 space-y-4 shadow-sm"
        >
          <h2 className="font-semibold text-slate-900 dark:text-white text-sm">기본 정보</h2>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">업체명 *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => update('name', e.target.value)}
              required
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">업종</label>
            <div className="grid grid-cols-4 gap-2">
              {INDUSTRIES.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => update('industry', value)}
                  className={cn(
                    'py-2 px-2 rounded-xl text-xs font-medium transition-all text-center',
                    form.industry === value
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">영업 상태</label>
            <select
              value={form.sales_status}
              onChange={(e) => update('sales_status', e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {Object.entries(SC).map(([value, config]) => (
                <option key={value} value={value}>
                  {config.emoji} {config.label}
                </option>
              ))}
            </select>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-5 space-y-4 shadow-sm"
        >
          <h2 className="font-semibold text-slate-900 dark:text-white text-sm">연락처</h2>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">담당자</label>
              <input
                type="text"
                value={form.contact_name}
                onChange={(e) => update('contact_name', e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">전화번호</label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => update('phone', e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">이메일</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => update('email', e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">주소</label>
            <div className="relative">
              <input
                type="text"
                value={form.address}
                onChange={(e) => update('address', e.target.value)}
                className="w-full pl-4 pr-10 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <MapPin className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-5 space-y-4 shadow-sm"
        >
          <h2 className="font-semibold text-slate-900 dark:text-white text-sm">메모 & 태그</h2>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">메모</label>
            <textarea
              value={form.memo}
              onChange={(e) => update('memo', e.target.value)}
              rows={4}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">태그 (쉼표로 구분)</label>
            <input
              type="text"
              value={form.tags}
              onChange={(e) => update('tags', e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-5 shadow-sm"
        >
          <h2 className="font-semibold text-slate-900 dark:text-white text-sm mb-4">사진</h2>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col items-center gap-2 p-4 border-2 border-dashed border-slate-200 dark:border-slate-600 rounded-xl cursor-pointer hover:border-blue-300 transition-colors">
              <Camera className="w-6 h-6 text-slate-400" />
              <span className="text-xs text-slate-400">업체 사진</span>
              <input type="file" accept="image/*" capture="environment" className="hidden" />
            </label>
            <label className="flex flex-col items-center gap-2 p-4 border-2 border-dashed border-slate-200 dark:border-slate-600 rounded-xl cursor-pointer hover:border-blue-300 transition-colors">
              <Camera className="w-6 h-6 text-slate-400" />
              <span className="text-xs text-slate-400">명함 촬영</span>
              <input type="file" accept="image/*" capture="environment" className="hidden" />
            </label>
          </div>
        </motion.div>
      </form>
    </div>
  )
}
