'use client'

import { useEffect, useState, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { Mic, Square, Phone, Loader2, CheckCircle2, Brain, Clock, ChevronRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/useAuth'
import { CallRecord, Client } from '@/types'
import { formatDate, formatDuration, getProbabilityColor } from '@/lib/utils'
import Link from 'next/link'

type RecordState = 'idle' | 'recording' | 'uploading' | 'analyzing' | 'done'
type CallListItem = CallRecord & { client: Pick<Client, 'id' | 'name'> | null }

export default function CallsPage() {
  const { profile } = useAuth()
  const supabase = createClient()
  const searchParams = useSearchParams()

  const [calls, setCalls] = useState<CallListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [recordState, setRecordState] = useState<RecordState>('idle')
  const [recordError, setRecordError] = useState<string | null>(null)
  const [duration, setDuration] = useState(0)
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [clients, setClients] = useState<Client[]>([])
  const mediaRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (!profile) return
    const currentProfile = profile

    let cancelled = false

    async function fetchPageData() {
      const [{ data: callsData }, { data: clientsData }] = await Promise.all([
        supabase
          .from('call_records')
          .select('*, client:clients(id, name)')
          .eq('user_id', currentProfile.id)
          .order('created_at', { ascending: false })
          .limit(20),
        supabase
          .from('clients')
          .select('id, name')
          .eq('owner_id', currentProfile.id)
          .order('name')
          .limit(50),
      ])

      if (cancelled) return

      const loadedClients = (clientsData || []) as Client[]
      setCalls((callsData || []) as CallListItem[])
      setClients(loadedClients)
      setLoading(false)

      const preferredClientId = searchParams.get('client')
      if (preferredClientId && !selectedClient) {
        const matchedClient = loadedClients.find((client) => client.id === preferredClientId) || null
        if (matchedClient) {
          setSelectedClient(matchedClient)
        }
      }
    }

    void fetchPageData()

    return () => {
      cancelled = true
    }
  }, [profile, searchParams, selectedClient, supabase])

  async function loadCalls() {
    if (!profile) return
    const { data } = await supabase
      .from('call_records')
      .select('*, client:clients(id, name)')
      .eq('user_id', profile!.id)
      .order('created_at', { ascending: false })
      .limit(20)
    setCalls((data || []) as CallListItem[])
    setLoading(false)
  }

  const startRecording = async () => {
    try {
      setRecordError(null)
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      chunksRef.current = []
      mediaRef.current = recorder
      recorder.ondataavailable = (e) => chunksRef.current.push(e.data)
      recorder.start()
      setRecordState('recording')
      setDuration(0)
      timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000)
    } catch {
      alert('마이크 접근 권한이 필요합니다.')
    }
  }

  const stopAndAnalyze = async () => {
    if (!mediaRef.current) return
    mediaRef.current.onstop = async () => {
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
      await processAudio(blob)
    }
    mediaRef.current.stop()
    mediaRef.current.stream.getTracks().forEach((t) => t.stop())
    if (timerRef.current) clearInterval(timerRef.current)
    setRecordState('uploading')
  }

  const processAudio = async (blob: Blob) => {
    let callRecordId: string | null = null
    let transcript = ''

    try {
      setRecordError(null)
      setRecordState('uploading')
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        throw new Error('로그인이 만료되었습니다. 다시 로그인해주세요.')
      }

      // 오디오 업로드
      const filename = `calls/${user.id}/${Date.now()}.webm`
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('audio')
        .upload(filename, blob)
      if (uploadError) {
        throw new Error(uploadError.message || '오디오 업로드에 실패했습니다.')
      }

      // 통화 기록 생성
      const { data: callRecord, error: callRecordError } = await supabase
        .from('call_records')
        .insert({
          client_id: selectedClient?.id || null,
          user_id: user.id,
          duration_seconds: duration,
          audio_url: uploadData?.path,
          status: 'PROCESSING',
        })
        .select()
        .single()
      if (callRecordError || !callRecord) {
        throw new Error(callRecordError?.message || '통화 기록 생성에 실패했습니다.')
      }
      callRecordId = callRecord.id

      setRecordState('analyzing')

      // Transcribe
      const formData = new FormData()
      formData.append('audio', blob, 'call.webm')
      const transcribeRes = await fetch('/api/ai/transcribe', { method: 'POST', body: formData })
      const transcribeData = await transcribeRes.json()
      if (!transcribeRes.ok) {
        throw new Error(transcribeData.error || '음성 인식에 실패했습니다.')
      }
      if (!transcribeData.text) {
        throw new Error('음성 인식 결과가 비어 있습니다.')
      }
      transcript = transcribeData.text

      // Analyze
      const analyzeRes = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript,
          type: 'call',
          clientContext: selectedClient ? `고객명: ${selectedClient.name}` : '',
        }),
      })
      const analyzeData = await analyzeRes.json()
      if (!analyzeRes.ok) {
        throw new Error(analyzeData.error || 'AI 분석에 실패했습니다.')
      }
      if (!analyzeData.analysis) {
        throw new Error('AI 분석 결과가 비어 있습니다.')
      }
      const { analysis } = analyzeData

      // Update record
      await supabase.from('call_records').update({
        transcript,
        analysis,
        status: 'COMPLETED',
      }).eq('id', callRecordId)

      // Activity 기록
      if (selectedClient) {
        await supabase.from('activities').insert({
          client_id: selectedClient.id,
          user_id: user.id,
          type: 'CALL',
          content: `통화 완료. AI 분석: ${analysis?.summary || '분석 완료'}`,
          metadata: { call_id: callRecordId, analysis },
        })

        // 계약 확률 업데이트
        if (analysis?.contract_probability) {
          await supabase.from('clients').update({
            contract_probability: analysis.contract_probability,
            last_contacted_at: new Date().toISOString(),
            next_contact_at: analysis.next_contact_date,
          }).eq('id', selectedClient.id)
        }
      }

      setRecordState('done')
      await loadCalls()
    } catch (err) {
      console.error(err)
      if (callRecordId) {
        await supabase.from('call_records').update({
          transcript: transcript || null,
          status: 'FAILED',
        }).eq('id', callRecordId)
      }
      setRecordError(err instanceof Error ? err.message : '통화 분석에 실패했습니다.')
      setRecordState('idle')
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto">
      <h1 className="text-xl font-bold text-slate-900 dark:text-white mb-6">통화 기록</h1>

      {/* Recording Card */}
      <motion.div
        className="bg-gradient-to-br from-slate-900 to-blue-950 rounded-2xl p-6 mb-6 shadow-xl"
      >
        <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
          <Mic className="w-5 h-5 text-blue-400" />
          통화 녹음 & AI 분석
        </h2>

        {/* Client selector */}
        <select
          value={selectedClient?.id || ''}
          onChange={(e) => setSelectedClient(clients.find((c) => c.id === e.target.value) || null)}
          className="w-full px-4 py-2.5 bg-white/10 border border-white/20 rounded-xl text-white text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">거래처 선택 (선택사항)</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id} className="text-slate-900">{c.name}</option>
          ))}
        </select>

        <div className="flex flex-col items-center gap-4">
          {recordState === 'idle' && (
            <>
              <button
                onClick={startRecording}
                className="w-20 h-20 bg-red-500 hover:bg-red-400 rounded-full flex items-center justify-center shadow-lg shadow-red-500/30 transition-all active:scale-95"
              >
                <Mic className="w-9 h-9 text-white" />
              </button>
              {recordError && (
                <p className="text-center text-sm text-rose-300">{recordError}</p>
              )}
            </>
          )}

          {recordState === 'recording' && (
            <>
              <motion.button
                onClick={stopAndAnalyze}
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
                className="w-20 h-20 bg-red-500 rounded-full flex items-center justify-center shadow-lg relative"
              >
                <div className="absolute inset-0 rounded-full bg-red-400 animate-ping opacity-30" />
                <Square className="w-8 h-8 text-white" />
              </motion.button>
              <span className="text-2xl font-mono text-white">{formatDuration(duration)}</span>
              <span className="text-blue-300 text-sm">녹음 중... 탭하여 중지 및 분석</span>
            </>
          )}

          {recordState === 'uploading' && (
            <div className="text-center">
              <Loader2 className="w-10 h-10 text-blue-400 animate-spin mx-auto" />
              <p className="text-blue-200 text-sm mt-2">업로드 중...</p>
            </div>
          )}

          {recordState === 'analyzing' && (
            <div className="text-center">
              <Brain className="w-10 h-10 text-purple-400 animate-pulse mx-auto" />
              <p className="text-purple-200 text-sm mt-2">AI가 통화 내용을 분석 중...</p>
              <p className="text-slate-400 text-xs mt-1">잠시만 기다려주세요</p>
            </div>
          )}

          {recordState === 'done' && (
            <div className="text-center">
              <CheckCircle2 className="w-10 h-10 text-green-400 mx-auto" />
              <p className="text-green-200 text-sm mt-2">분석 완료!</p>
              <button onClick={() => setRecordState('idle')} className="mt-3 px-4 py-2 bg-white/20 text-white rounded-xl text-sm hover:bg-white/30">
                새 녹음
              </button>
            </div>
          )}
        </div>
      </motion.div>

      {/* Call History */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700">
          <h2 className="font-semibold text-slate-900 dark:text-white">최근 통화</h2>
        </div>

        {loading ? (
          <div className="p-4 space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 bg-slate-100 dark:bg-slate-700 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : calls.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">
            <Phone className="w-8 h-8 mx-auto mb-2 opacity-30" />
            통화 기록이 없습니다
          </div>
        ) : (
          <div className="divide-y divide-slate-50 dark:divide-slate-700/50">
            {calls.map((call) => (
              <div key={call.id} className="p-4 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${call.status === 'COMPLETED' ? 'bg-green-50 dark:bg-green-950' : 'bg-amber-50 dark:bg-amber-950'}`}>
                  {call.status === 'COMPLETED' ? (
                    <Brain className="w-5 h-5 text-green-600" />
                  ) : (
                    <Loader2 className="w-5 h-5 text-amber-600 animate-spin" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-slate-900 dark:text-white text-sm">
                      {call.client?.name || '알 수 없는 거래처'}
                    </p>
                    {call.analysis && (
                      <span className={`text-xs font-bold ${getProbabilityColor(call.analysis.contract_probability)}`}>
                        {call.analysis.contract_probability}%
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-400">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {call.duration_seconds ? formatDuration(call.duration_seconds) : '-'}
                    </span>
                    <span>{formatDate(call.created_at)}</span>
                  </div>
                  {call.analysis?.summary && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 truncate">{call.analysis.summary}</p>
                  )}
                </div>
                {call.client && (
                  <Link href={`/clients/${call.client.id}`}>
                    <ChevronRight className="w-5 h-5 text-slate-300" />
                  </Link>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
