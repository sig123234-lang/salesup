'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  ArrowLeft, Phone, MapPin, Edit3, Navigation, Mic, Calendar,
  Clock, MoreVertical
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Client, Activity, CallRecord, VisitRecord } from '@/types'
import { SALES_STATUS_CONFIG, formatDate, formatRelativeTime, getProbabilityBg, getProbabilityColor } from '@/lib/utils'
import Link from 'next/link'
import { useUIStore } from '@/store'

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const supabase = createClient()
  const { setActiveVisitId } = useUIStore()

  const [client, setClient] = useState<Client | null>(null)
  const [activities, setActivities] = useState<Activity[]>([])
  const [calls, setCalls] = useState<CallRecord[]>([])
  const [visits, setVisits] = useState<VisitRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'timeline' | 'calls' | 'visits'>('timeline')

  async function startVisit() {
    if (!client) return
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return

    const { data } = await supabase.from('visit_records').insert({
      client_id: client.id,
      user_id: user.id,
      company_id: client.company_id,
      status: 'IN_PROGRESS',
    }).select().single()
    if (data) {
      setActiveVisitId(data.id)
      router.push('/visits')
    }
  }

  useEffect(() => {
    let cancelled = false

    async function fetchClient() {
      const [clientRes, activitiesRes, callsRes, visitsRes] = await Promise.all([
        supabase.from('clients').select('*').eq('id', id).single(),
        supabase.from('activities').select('*, user:profiles(full_name)').eq('client_id', id).order('created_at', { ascending: false }).limit(20),
        supabase.from('call_records').select('*').eq('client_id', id).order('created_at', { ascending: false }).limit(10),
        supabase.from('visit_records').select('*').eq('client_id', id).order('created_at', { ascending: false }).limit(10),
      ])

      if (cancelled) return

      setClient(clientRes.data as Client)
      setActivities((activitiesRes.data || []) as Activity[])
      setCalls((callsRes.data || []) as CallRecord[])
      setVisits((visitsRes.data || []) as VisitRecord[])
      setLoading(false)
    }

    void fetchClient()

    return () => {
      cancelled = true
    }
  }, [id, supabase])

  if (loading) {
    return (
      <div className="p-4 md:p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-32 bg-slate-100 dark:bg-slate-800 rounded-2xl" />
          <div className="h-64 bg-slate-100 dark:bg-slate-800 rounded-2xl" />
        </div>
      </div>
    )
  }

  if (!client) {
    return (
      <div className="p-8 text-center text-slate-500">
        <p>거래처를 찾을 수 없습니다.</p>
        <button onClick={() => router.back()} className="mt-4 text-blue-600">돌아가기</button>
      </div>
    )
  }

  const sc = SALES_STATUS_CONFIG[client.sales_status]

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-100 dark:border-slate-800 px-4 md:px-6 py-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
          <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
        </button>
        <h1 className="font-semibold text-slate-900 dark:text-white flex-1 truncate">{client.name}</h1>
        <Link href={`/clients/${id}/edit`}>
          <button className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <Edit3 className="w-5 h-5 text-slate-400" />
          </button>
        </Link>
        <button className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
          <MoreVertical className="w-5 h-5 text-slate-400" />
        </button>
      </div>

      <div className="px-4 md:px-6 py-6 space-y-5">
        {/* Client Info Card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 overflow-hidden shadow-sm"
        >
          {/* Status bar */}
          <div className={`h-1.5 w-full ${sc.bg}`}>
            <div
              className={`h-full ${getProbabilityBg(client.contract_probability)} transition-all`}
              style={{ width: `${client.contract_probability}%` }}
            />
          </div>

          <div className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">{client.name}</h2>
                  <span className={`text-xs px-2.5 py-1 rounded-full ${sc.bg} ${sc.color} font-medium`}>
                    {sc.emoji} {sc.label}
                  </span>
                </div>
                {client.contact_name && (
                  <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">담당: {client.contact_name}</p>
                )}
              </div>
              <div className="text-right">
                <div className={`text-2xl font-bold ${getProbabilityColor(client.contract_probability)}`}>
                  {client.contract_probability}%
                </div>
                <div className="text-xs text-slate-400">계약 확률</div>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              {client.phone && (
                <a href={`tel:${client.phone}`} className="flex items-center gap-3 text-sm group">
                  <div className="w-8 h-8 bg-green-50 dark:bg-green-950 rounded-lg flex items-center justify-center">
                    <Phone className="w-4 h-4 text-green-600" />
                  </div>
                  <span className="text-slate-700 dark:text-slate-300 group-hover:text-blue-600 transition-colors">{client.phone}</span>
                </a>
              )}
              {client.address && (
                <div className="flex items-center gap-3 text-sm">
                  <div className="w-8 h-8 bg-blue-50 dark:bg-blue-950 rounded-lg flex items-center justify-center">
                    <MapPin className="w-4 h-4 text-blue-600" />
                  </div>
                  <span className="text-slate-700 dark:text-slate-300">{client.address}</span>
                </div>
              )}
              {client.last_contacted_at && (
                <div className="flex items-center gap-3 text-sm">
                  <div className="w-8 h-8 bg-purple-50 dark:bg-purple-950 rounded-lg flex items-center justify-center">
                    <Clock className="w-4 h-4 text-purple-600" />
                  </div>
                  <span className="text-slate-500">마지막 연락: {formatRelativeTime(client.last_contacted_at)}</span>
                </div>
              )}
            </div>

            {client.next_contact_at && (
              <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-xl flex items-center gap-2">
                <Calendar className="w-4 h-4 text-amber-600" />
                <span className="text-sm text-amber-700 dark:text-amber-400">
                  다음 연락: <strong>{formatDate(client.next_contact_at)}</strong>
                </span>
              </div>
            )}

            {client.memo && (
              <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{client.memo}</p>
              </div>
            )}

            {/* Tags */}
            {client.tags && client.tags.length > 0 && (
              <div className="flex gap-2 mt-4 flex-wrap">
                {client.tags.map((tag) => (
                  <span key={tag} className="text-xs bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 px-2.5 py-1 rounded-full">
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </motion.div>

        {/* Quick Actions */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { icon: Phone, label: '전화', color: 'text-green-600 bg-green-50 dark:bg-green-950', action: () => window.open(`tel:${client.phone}`) },
            { icon: Navigation, label: '방문 시작', color: 'text-blue-600 bg-blue-50 dark:bg-blue-950', action: startVisit },
            { icon: Mic, label: '통화 녹음', color: 'text-red-600 bg-red-50 dark:bg-red-950', action: () => router.push(`/calls?client=${id}`) },
            { icon: Calendar, label: '일정 추가', color: 'text-purple-600 bg-purple-50 dark:bg-purple-950', action: () => router.push('/calendar?new=1') },
          ].map(({ icon: Icon, label, color, action }) => (
            <button
              key={label}
              onClick={action}
              className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl ${color} hover:opacity-80 transition-all active:scale-95`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-xs font-medium">{label}</span>
            </button>
          ))}
        </div>

        {/* Tabs */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 overflow-hidden shadow-sm">
          <div className="flex border-b border-slate-100 dark:border-slate-700">
            {(['timeline', 'calls', 'visits'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-3 text-sm font-medium transition-all ${
                  activeTab === tab
                    ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50 dark:bg-blue-950/30'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {tab === 'timeline' && '📝 타임라인'}
                {tab === 'calls' && `📞 통화 (${calls.length})`}
                {tab === 'visits' && `🚗 방문 (${visits.length})`}
              </button>
            ))}
          </div>

          <div className="p-4">
            {/* Timeline */}
            {activeTab === 'timeline' && (
              <div className="space-y-3">
                {activities.length === 0 ? (
                  <p className="text-center text-slate-400 py-6 text-sm">활동 기록이 없습니다</p>
                ) : (
                  activities.map((act) => (
                    <div key={act.id} className="flex gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center flex-shrink-0 text-sm">
                        {act.type === 'CALL' ? '📞' : act.type === 'VISIT' ? '🚗' : act.type === 'AI_INSIGHT' ? '🤖' : '📝'}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{act.content}</p>
                        <p className="text-xs text-slate-400 mt-1">{formatRelativeTime(act.created_at)}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Calls */}
            {activeTab === 'calls' && (
              <div className="space-y-3">
                {calls.length === 0 ? (
                  <p className="text-center text-slate-400 py-6 text-sm">통화 기록이 없습니다</p>
                ) : (
                  calls.map((call) => (
                    <div key={call.id} className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                          {formatDate(call.created_at)}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${call.status === 'COMPLETED' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                          {call.status === 'COMPLETED' ? '분석 완료' : call.status}
                        </span>
                      </div>
                      {call.analysis && (
                        <div className="mt-2 text-xs text-slate-500 space-y-1">
                          <p>📊 계약 확률: <strong>{call.analysis.contract_probability}%</strong></p>
                          <p>💬 {call.analysis.summary}</p>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Visits */}
            {activeTab === 'visits' && (
              <div className="space-y-3">
                {visits.length === 0 ? (
                  <p className="text-center text-slate-400 py-6 text-sm">방문 기록이 없습니다</p>
                ) : (
                  visits.map((visit) => (
                    <div key={visit.id} className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                          {formatDate(visit.started_at)}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${visit.status === 'COMPLETED' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                          {visit.status === 'IN_PROGRESS' ? '방문 중' : visit.status === 'COMPLETED' ? '완료' : visit.status}
                        </span>
                      </div>
                      {visit.analysis && (
                        <div className="mt-2 text-xs text-slate-500">
                          <p>💬 {visit.analysis.summary}</p>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
