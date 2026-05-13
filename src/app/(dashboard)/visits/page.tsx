'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Navigation, Square, Clock, CheckCircle2, ChevronRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/useAuth'
import { VisitRecord, Client } from '@/types'
import { formatDate } from '@/lib/utils'
import Link from 'next/link'
import { useUIStore } from '@/store'

type VisitListItem = VisitRecord & { client: Pick<Client, 'id' | 'name' | 'address'> | null }

export default function VisitsPage() {
  const { profile } = useAuth()
  const supabase = createClient()
  const { activeVisitId, setActiveVisitId } = useUIStore()

  const [visits, setVisits] = useState<VisitListItem[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedClientId, setSelectedClientId] = useState('')
  const [currentVisit, setCurrentVisit] = useState<VisitRecord | null>(null)
  const [visitDuration, setVisitDuration] = useState(0)
  const [visitError, setVisitError] = useState<string | null>(null)

  useEffect(() => {
    if (!profile) return
    const currentProfile = profile

    let cancelled = false

    async function fetchPageData() {
      const [visitsRes, clientsRes, currentVisitRes] = await Promise.all([
        supabase
          .from('visit_records')
          .select('*, client:clients(id, name, address)')
          .eq('user_id', currentProfile.id)
          .order('started_at', { ascending: false })
          .limit(20),
        supabase
          .from('clients')
          .select('id, name, address')
          .eq('owner_id', currentProfile.id)
          .order('name'),
        activeVisitId
          ? supabase.from('visit_records').select('*').eq('id', activeVisitId).single()
          : Promise.resolve({ data: null }),
      ])

      if (cancelled) return

      setVisits((visitsRes.data || []) as VisitListItem[])
      setClients((clientsRes.data || []) as Client[])
      setLoading(false)

      const currentVisitData = currentVisitRes.data
      if (currentVisitData && !currentVisitData.ended_at) {
        setCurrentVisit(currentVisitData as VisitRecord)
      }
    }

    void fetchPageData()

    return () => {
      cancelled = true
    }
  }, [activeVisitId, profile, supabase])

  useEffect(() => {
    let timer: NodeJS.Timeout | null = null
    if (currentVisit && !currentVisit.ended_at) {
      const start = new Date(currentVisit.started_at).getTime()
      timer = setInterval(() => {
        setVisitDuration(Math.floor((Date.now() - start) / 1000))
      }, 1000)
    }
    return () => { if (timer) clearInterval(timer) }
  }, [currentVisit])

  async function loadVisits() {
    if (!profile) return
    const { data } = await supabase
      .from('visit_records')
      .select('*, client:clients(id, name, address)')
      .eq('user_id', profile!.id)
      .order('started_at', { ascending: false })
      .limit(20)
    setVisits((data || []) as VisitListItem[])
    setLoading(false)
  }

  const startVisit = async () => {
    if (!selectedClientId) {
      alert('방문할 거래처를 선택해주세요.')
      return
    }
    setVisitError(null)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // 위치 가져오기
    let lat = null, lng = null
    if (navigator.geolocation) {
      const pos = await new Promise<GeolocationPosition>((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, { timeout: 5000 })
      ).catch(() => null)
      if (pos) { lat = pos.coords.latitude; lng = pos.coords.longitude }
    }

    const { data } = await supabase
      .from('visit_records')
      .insert({
        client_id: selectedClientId,
        user_id: user.id,
        company_id: profile?.company_id,
        status: 'IN_PROGRESS',
        lat, lng,
      })
      .select()
      .single()

    if (data) {
      setCurrentVisit(data as VisitRecord)
      setActiveVisitId(data.id)

      await supabase.from('activities').insert({
        client_id: selectedClientId,
        user_id: user.id,
        type: 'VISIT',
        content: '방문을 시작했습니다.',
        metadata: { visit_id: data.id, lat, lng },
      })

      await supabase.from('clients').update({ last_contacted_at: new Date().toISOString() }).eq('id', selectedClientId)
    }
  }

  const endVisit = async (audioBlob?: Blob) => {
    if (!currentVisit) return

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    setVisitError(null)
    let transcript = null
    let analysis = null

    if (audioBlob) {
      try {
        const formData = new FormData()
        formData.append('audio', audioBlob, 'visit.webm')
        const transcribeRes = await fetch('/api/ai/transcribe', { method: 'POST', body: formData })
        const transcribeData = await transcribeRes.json()
        if (!transcribeRes.ok) {
          throw new Error(transcribeData.error || '음성 인식에 실패했습니다.')
        }
        if (!transcribeData.text) {
          throw new Error('음성 인식 결과가 비어 있습니다.')
        }
        transcript = transcribeData.text

        const analyzeRes = await fetch('/api/ai/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transcript: transcribeData.text, type: 'visit' }),
        })
        const data = await analyzeRes.json()
        if (!analyzeRes.ok) {
          throw new Error(data.error || 'AI 분석에 실패했습니다.')
        }
        analysis = data.analysis
      } catch (err) {
        console.error(err)
        setVisitError(err instanceof Error ? err.message : '방문 AI 분석에 실패했습니다.')
      }
    }

    await supabase.from('visit_records').update({
      ended_at: new Date().toISOString(),
      transcript,
      analysis,
      status: 'COMPLETED',
    }).eq('id', currentVisit.id)

    if (analysis && currentVisit.client_id) {
      await supabase.from('activities').insert({
        client_id: currentVisit.client_id,
        user_id: user.id,
        type: 'AI_INSIGHT',
        content: `방문 완료. AI 분석: ${analysis.summary || ''}`,
        metadata: { visit_id: currentVisit.id, analysis },
      })
    }

    setCurrentVisit(null)
    setActiveVisitId(null)
    await loadVisits()
  }

  const formatDur = (s: number) => `${Math.floor(s / 60)}분 ${s % 60}초`

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto">
      <h1 className="text-xl font-bold text-slate-900 dark:text-white mb-6">방문 기록</h1>
      {visitError && (
        <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200">
          {visitError}
        </p>
      )}

      {/* Active Visit */}
      {currentVisit ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-6 mb-6 text-white shadow-xl shadow-blue-500/20"
        >
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <span className="font-semibold">방문 진행 중</span>
          </div>
          <div className="text-4xl font-mono font-bold mb-1">{formatDur(visitDuration)}</div>
          <p className="text-blue-200 text-sm mb-5">
            {clients.find((c) => c.id === currentVisit.client_id)?.name || ''}
          </p>
          <button
            onClick={() => endVisit()}
            className="w-full py-3 bg-white/20 hover:bg-white/30 rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors"
          >
            <Square className="w-5 h-5" />
            방문 종료
          </button>
        </motion.div>
      ) : (
        <motion.div
          className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-5 mb-6 shadow-sm"
        >
          <h2 className="font-semibold text-slate-900 dark:text-white mb-4">새 방문 시작</h2>
          <select
            value={selectedClientId}
            onChange={(e) => setSelectedClientId(e.target.value)}
            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-sm text-slate-900 dark:text-white mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">거래처 선택</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <button
            onClick={startVisit}
            disabled={!selectedClientId}
            className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold flex items-center justify-center gap-2 disabled:opacity-40 transition-colors"
          >
            <Navigation className="w-5 h-5" />
            방문 시작
          </button>
        </motion.div>
      )}

      {/* Visit History */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700">
          <h2 className="font-semibold text-slate-900 dark:text-white">방문 이력</h2>
        </div>

        {loading ? (
          <div className="p-4 space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 bg-slate-100 dark:bg-slate-700 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : visits.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">
            <Navigation className="w-8 h-8 mx-auto mb-2 opacity-30" />
            방문 기록이 없습니다
          </div>
        ) : (
          <div className="divide-y divide-slate-50 dark:divide-slate-700/50">
            {visits.map((visit) => {
              const dur = visit.ended_at
                ? Math.floor((new Date(visit.ended_at).getTime() - new Date(visit.started_at).getTime()) / 1000)
                : null
              return (
                <div key={visit.id} className="p-4 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${visit.status === 'COMPLETED' ? 'bg-green-50 dark:bg-green-950' : 'bg-blue-50 dark:bg-blue-950'}`}>
                    {visit.status === 'COMPLETED' ? (
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                    ) : (
                      <Navigation className="w-5 h-5 text-blue-600 animate-pulse" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900 dark:text-white text-sm">
                      {visit.client?.name || '알 수 없음'}
                    </p>
                    <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {dur ? formatDur(dur) : '진행 중'}
                      </span>
                      <span>{formatDate(visit.started_at)}</span>
                    </div>
                    {visit.analysis?.summary && (
                      <p className="text-xs text-slate-500 mt-1 truncate">{visit.analysis.summary}</p>
                    )}
                  </div>
                  {visit.client && (
                    <Link href={`/clients/${visit.client.id}`}>
                      <ChevronRight className="w-5 h-5 text-slate-300" />
                    </Link>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
