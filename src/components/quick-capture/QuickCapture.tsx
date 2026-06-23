'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Calendar,
  Camera,
  FileText,
  Loader2,
  Mic,
  Send,
  Square,
  Upload,
  UserPlus,
  X,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/useAuth'
import { useQuickCaptureStore } from '@/store'
import type { Client, QuickCaptureMode } from '@/types'

type RecordingState = 'idle' | 'recording' | 'processing' | 'done'
type ActiveQuickCaptureMode = Exclude<QuickCaptureMode['mode'], null>
type ClientOption = Pick<Client, 'id' | 'name'>

const createDefaultEventForm = () => {
  const start = new Date()
  start.setMinutes(Math.ceil(start.getMinutes() / 15) * 15, 0, 0)

  const end = new Date(start.getTime() + 60 * 60 * 1000)
  const format = (date: Date) => {
    const pad = (value: number) => String(value).padStart(2, '0')

    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
      date.getHours()
    )}:${pad(date.getMinutes())}`
  }

  return {
    title: '',
    startAt: format(start),
    endAt: format(end),
  }
}

export default function QuickCapture() {
  const { isOpen, mode, close } = useQuickCaptureStore()

  if (!isOpen || !mode) return null

  return <QuickCaptureContent key={mode} mode={mode} close={close} />
}

function QuickCaptureContent({
  mode,
  close,
}: {
  mode: ActiveQuickCaptureMode
  close: () => void
}) {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const { profile } = useAuth()

  const [recordingState, setRecordingState] = useState<RecordingState>('idle')
  const [transcript, setTranscript] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [noteText, setNoteText] = useState('')
  const [duration, setDuration] = useState(0)
  const [clients, setClients] = useState<ClientOption[]>([])
  const [selectedClientId, setSelectedClientId] = useState('')
  const [clientForm, setClientForm] = useState({
    name: '',
    phone: '',
    address: '',
  })
  const [eventForm, setEventForm] = useState(createDefaultEventForm)
  const [cardState, setCardState] = useState<'idle' | 'processing' | 'review'>('idle')
  const [cardPreview, setCardPreview] = useState<string | null>(null)
  const [cardWarning, setCardWarning] = useState<string | null>(null)
  const [cardForm, setCardForm] = useState({
    name: '',
    company: '',
    contact_name: '',
    phone: '',
    email: '',
    address: '',
    department: '',
    position: '',
    business_card_url: null as string | null,
  })

  const mediaRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const cardInputRef = useRef<HTMLInputElement | null>(null)
  const cardCameraRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!profile || !['VOICE', 'NOTE'].includes(mode)) return

    const currentProfile = profile
    let cancelled = false

    async function loadClients() {
      const query = supabase
        .from('clients')
        .select('id, name')
        .order('name')
        .limit(50)

      const { data } = currentProfile.company_id
        ? await query.or(
            `owner_id.eq.${currentProfile.id},company_id.eq.${currentProfile.company_id}`
          )
        : await query.eq('owner_id', currentProfile.id)

      if (cancelled) return

      const loadedClients = (data || []) as ClientOption[]
      setClients(loadedClients)
      if (loadedClients.length === 1) {
        setSelectedClientId(loadedClients[0].id)
      }
    }

    void loadClients()

    return () => {
      cancelled = true
    }
  }, [mode, profile, supabase])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      mediaRef.current?.stream.getTracks().forEach((track) => track.stop())
    }
  }, [])

  const handleClose = () => {
    if (timerRef.current) clearInterval(timerRef.current)
    mediaRef.current?.stream.getTracks().forEach((track) => track.stop())
    setErrorMessage(null)
    setSuccessMessage(null)
    close()
  }

  const finishFlow = (message: string, nextPath?: string) => {
    setSuccessMessage(message)
    setErrorMessage(null)

    window.setTimeout(() => {
      handleClose()
      if (nextPath) {
        router.push(nextPath)
      } else {
        router.refresh()
      }
    }, 700)
  }

  const startRecording = async () => {
    try {
      setErrorMessage(null)
      setSuccessMessage(null)
      setTranscript('')
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      chunksRef.current = []
      mediaRef.current = recorder

      recorder.ondataavailable = (e) => chunksRef.current.push(e.data)
      recorder.onstop = handleRecordingStop

      recorder.start()
      setRecordingState('recording')
      setDuration(0)
      timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000)
    } catch {
      setErrorMessage('마이크 접근 권한이 필요합니다.')
    }
  }

  const stopRecording = () => {
    if (mediaRef.current && recordingState === 'recording') {
      mediaRef.current.stop()
      mediaRef.current.stream.getTracks().forEach((t) => t.stop())
      if (timerRef.current) clearInterval(timerRef.current)
      setRecordingState('processing')
    }
  }

  const handleRecordingStop = async () => {
    const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
    const formData = new FormData()
    formData.append('audio', blob, 'recording.webm')

    try {
      const res = await fetch('/api/ai/transcribe', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || '음성 인식에 실패했습니다.')
      }
      if (!data.text) {
        throw new Error('음성 인식 결과가 비어 있습니다.')
      }
      setTranscript(data.text || '')
      setErrorMessage(null)
      setRecordingState('done')
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '음성 인식에 실패했습니다.')
      setTranscript('(음성 인식 실패)')
      setRecordingState('done')
    }
  }

  const saveVoiceMemo = async () => {
    if (!profile) return
    if (!selectedClientId) {
      setErrorMessage('저장할 거래처를 선택해주세요.')
      return
    }
    if (!transcript || transcript === '(음성 인식 실패)') {
      setErrorMessage('저장할 음성 인식 결과가 없습니다.')
      return
    }

    setSaving(true)
    setErrorMessage(null)

    const { data: callRecord, error: callError } = await supabase
      .from('call_records')
      .insert({
        client_id: selectedClientId,
        user_id: profile.id,
        company_id: profile.company_id,
        duration_seconds: duration,
        transcript,
        status: 'COMPLETED',
      })
      .select('id')
      .single()

    if (callError || !callRecord) {
      setErrorMessage(callError?.message || '음성 메모 저장에 실패했습니다.')
      setSaving(false)
      return
    }

    await supabase.from('activities').insert({
      client_id: selectedClientId,
      user_id: profile.id,
      type: 'CALL',
      content: transcript,
      metadata: { call_id: callRecord.id, source: 'quick_capture' },
    })

    await supabase
      .from('clients')
      .update({ last_contacted_at: new Date().toISOString() })
      .eq('id', selectedClientId)

    setSaving(false)
    finishFlow('음성 메모가 저장되었습니다.')
  }

  const saveQuickNote = async () => {
    if (!profile) return
    if (!selectedClientId) {
      setErrorMessage('메모를 남길 거래처를 선택해주세요.')
      return
    }
    if (!noteText.trim()) {
      setErrorMessage('메모를 입력해주세요.')
      return
    }

    setSaving(true)
    setErrorMessage(null)

    const { error } = await supabase.from('activities').insert({
      client_id: selectedClientId,
      user_id: profile.id,
      type: 'NOTE',
      content: noteText.trim(),
      metadata: { source: 'quick_capture' },
    })

    if (error) {
      setErrorMessage(error.message)
      setSaving(false)
      return
    }

    setSaving(false)
    finishFlow('메모가 저장되었습니다.')
  }

  const saveClient = async () => {
    if (!profile) return
    if (!clientForm.name.trim()) {
      setErrorMessage('업체명을 입력해주세요.')
      return
    }

    setSaving(true)
    setErrorMessage(null)

    const { data: client, error } = await supabase
      .from('clients')
      .insert({
        name: clientForm.name.trim(),
        phone: clientForm.phone.trim() || null,
        address: clientForm.address.trim() || null,
        owner_id: profile.id,
        company_id: profile.company_id,
        industry: 'general',
        contract_probability: 10,
      })
      .select('id')
      .single()

    if (error || !client) {
      setErrorMessage(error?.message || '고객 등록에 실패했습니다.')
      setSaving(false)
      return
    }

    await supabase.from('activities').insert({
      client_id: client.id,
      user_id: profile.id,
      type: 'NOTE',
      content: `${clientForm.name.trim()} 거래처가 빠른 등록으로 생성되었습니다.`,
      metadata: { source: 'quick_capture' },
    })

    setSaving(false)
    finishFlow('고객이 등록되었습니다.', `/clients/${client.id}`)
  }

  const handleCardFile = async (file: File) => {
    setErrorMessage(null)
    setCardWarning(null)
    setCardState('processing')
    const previewUrl = URL.createObjectURL(file)
    setCardPreview(previewUrl)

    try {
      const formData = new FormData()
      formData.append('image', file)
      const res = await fetch('/api/ai/ocr-card', { method: 'POST', body: formData })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || '명함 인식에 실패했습니다.')
      const data = json.data as typeof cardForm
      setCardForm({
        name: data.name || data.company || '',
        company: data.company || '',
        contact_name: data.contact_name || '',
        phone: data.phone || '',
        email: data.email || '',
        address: data.address || '',
        department: data.department || '',
        position: data.position || '',
        business_card_url: data.business_card_url ?? null,
      })
      if (json.storage_warning) setCardWarning(json.storage_warning as string)
      setCardState('review')
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : '명함 인식에 실패했습니다.')
      setCardState('idle')
    }
  }

  const saveCardClient = async () => {
    if (!profile) return
    if (!cardForm.name.trim() && !cardForm.company.trim()) {
      setErrorMessage('업체명을 확인해주세요.')
      return
    }

    setSaving(true)
    setErrorMessage(null)

    const finalName = cardForm.name.trim() || cardForm.company.trim()

    const { data: client, error } = await supabase
      .from('clients')
      .insert({
        name: finalName,
        contact_name: cardForm.contact_name.trim() || null,
        phone: cardForm.phone.trim() || null,
        email: cardForm.email.trim() || null,
        address: cardForm.address.trim() || null,
        business_card_url: cardForm.business_card_url,
        owner_id: profile.id,
        company_id: profile.company_id,
        industry: 'general',
        contract_probability: 10,
        custom_fields: {
          department: cardForm.department || null,
          position: cardForm.position || null,
        },
      })
      .select('id')
      .single()

    if (error || !client) {
      setErrorMessage(error?.message || '거래처 등록에 실패했습니다.')
      setSaving(false)
      return
    }

    await supabase.from('activities').insert({
      client_id: client.id,
      user_id: profile.id,
      type: 'NOTE',
      content: `명함 등록으로 거래처가 생성되었습니다. (${cardForm.contact_name || ''} ${cardForm.position || ''})`.trim(),
      metadata: { source: 'quick_capture', sub_source: 'business_card' },
    })

    setSaving(false)
    finishFlow('명함이 거래처로 등록되었습니다.', `/clients/${client.id}`)
  }

  const saveEvent = async () => {
    if (!profile) return
    if (!eventForm.title.trim()) {
      setErrorMessage('일정 제목을 입력해주세요.')
      return
    }
    if (!eventForm.startAt) {
      setErrorMessage('시작 시간을 입력해주세요.')
      return
    }

    setSaving(true)
    setErrorMessage(null)

    const startAt = new Date(eventForm.startAt)
    const endAt = new Date(eventForm.endAt || eventForm.startAt)

    if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
      setErrorMessage('일정 시간을 다시 확인해주세요.')
      setSaving(false)
      return
    }

    const { error } = await supabase.from('calendar_events').insert({
      user_id: profile.id,
      company_id: profile.company_id,
      title: eventForm.title.trim(),
      start_at: startAt.toISOString(),
      end_at: endAt.toISOString(),
      type: 'OTHER',
      metadata: { source: 'quick_capture' },
    })

    if (error) {
      setErrorMessage(error.message)
      setSaving(false)
      return
    }

    setSaving(false)
    finishFlow('일정이 등록되었습니다.', '/calendar')
  }

  const formatTime = (seconds: number) =>
    `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-end justify-center md:items-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleClose}
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        />

        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative z-10 w-full max-w-lg rounded-t-3xl bg-white p-6 shadow-2xl dark:bg-slate-900 md:rounded-2xl"
        >
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {mode === 'VOICE' && <Mic className="h-5 w-5 text-red-500" />}
              {mode === 'NOTE' && <FileText className="h-5 w-5 text-amber-500" />}
              {mode === 'CLIENT' && <UserPlus className="h-5 w-5 text-green-500" />}
              {mode === 'EVENT' && <Calendar className="h-5 w-5 text-purple-500" />}
              {mode === 'CARD' && <Camera className="h-5 w-5 text-sky-500" />}
              <h3 className="font-semibold text-slate-900 dark:text-white">
                {mode === 'VOICE' && '음성 메모'}
                {mode === 'NOTE' && '빠른 메모'}
                {mode === 'CLIENT' && '고객 추가'}
                {mode === 'EVENT' && '일정 추가'}
                {mode === 'CARD' && '명함 등록'}
              </h3>
            </div>
            <button
              onClick={handleClose}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {errorMessage && (
            <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
              {errorMessage}
            </p>
          )}

          {successMessage && (
            <p className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300">
              {successMessage}
            </p>
          )}

          {mode === 'VOICE' && (
            <div className="py-4 text-center">
              {recordingState === 'idle' && (
                <div>
                  <button
                    onClick={startRecording}
                    className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-red-500 shadow-lg shadow-red-500/30 transition-all active:scale-95 hover:bg-red-600"
                  >
                    <Mic className="h-9 w-9 text-white" />
                  </button>
                  <p className="mt-4 text-sm text-slate-500">버튼을 눌러 녹음 시작</p>
                </div>
              )}

              {recordingState === 'recording' && (
                <div>
                  <motion.button
                    onClick={stopRecording}
                    animate={{ scale: [1, 1.05, 1] }}
                    transition={{ repeat: Infinity, duration: 1.5 }}
                    className="relative mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-red-500 shadow-lg shadow-red-500/30"
                  >
                    <div className="absolute inset-0 rounded-full bg-red-400 opacity-30 animate-ping" />
                    <Square className="h-8 w-8 text-white" />
                  </motion.button>
                  <p className="mt-4 text-2xl font-mono text-red-500">{formatTime(duration)}</p>
                  <p className="text-sm text-slate-500">녹음 중... 탭하여 중지</p>
                </div>
              )}

              {recordingState === 'processing' && (
                <div className="py-4">
                  <Loader2 className="mx-auto h-10 w-10 animate-spin text-blue-500" />
                  <p className="mt-3 text-sm text-slate-500">AI가 음성을 분석 중...</p>
                </div>
              )}

              {recordingState === 'done' && transcript && (
                <div className="space-y-4 text-left">
                  <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800">
                    <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                      {transcript}
                    </p>
                  </div>

                  {clients.length === 0 ? (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                      음성 메모를 저장하려면 먼저 거래처를 등록해주세요.
                    </div>
                  ) : (
                    <select
                      value={selectedClientId}
                      onChange={(e) => setSelectedClientId(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    >
                      <option value="">거래처 선택</option>
                      {clients.map((client) => (
                        <option key={client.id} value={client.id}>
                          {client.name}
                        </option>
                      ))}
                    </select>
                  )}

                  <button
                    onClick={saveVoiceMemo}
                    disabled={saving || clients.length === 0}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-40"
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    저장하기
                  </button>
                </div>
              )}
            </div>
          )}

          {mode === 'NOTE' && (
            <div>
              {clients.length > 0 ? (
                <select
                  value={selectedClientId}
                  onChange={(e) => setSelectedClientId(e.target.value)}
                  className="mb-3 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  <option value="">거래처 선택</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="mb-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  메모 저장을 위해 거래처를 먼저 등록해주세요.
                </div>
              )}

              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="메모를 입력하세요..."
                rows={5}
                autoFocus
                className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
              <button
                onClick={saveQuickNote}
                disabled={!noteText.trim() || clients.length === 0 || saving}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 font-medium text-white transition-all hover:bg-blue-500 disabled:opacity-40"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                저장
              </button>
            </div>
          )}

          {mode === 'CLIENT' && (
            <div className="space-y-3">
              <input
                type="text"
                value={clientForm.name}
                onChange={(e) => setClientForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="업체명 *"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
              <input
                type="tel"
                value={clientForm.phone}
                onChange={(e) => setClientForm((prev) => ({ ...prev, phone: e.target.value }))}
                placeholder="전화번호"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
              <input
                type="text"
                value={clientForm.address}
                onChange={(e) =>
                  setClientForm((prev) => ({ ...prev, address: e.target.value }))
                }
                placeholder="주소"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
              <button
                onClick={saveClient}
                disabled={saving}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-green-600 py-3 font-medium text-white transition-colors hover:bg-green-500 disabled:opacity-40"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                고객 등록
              </button>
            </div>
          )}

          {mode === 'CARD' && (
            <div className="space-y-3">
              <input
                ref={cardInputRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) void handleCardFile(file)
                }}
              />
              <input
                ref={cardCameraRef}
                type="file"
                accept="image/*"
                capture="environment"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) void handleCardFile(file)
                }}
              />

              {cardState === 'idle' && (
                <>
                  <p className="text-sm text-slate-500 text-center mb-3">
                    명함을 촬영하거나 사진을 선택하면 AI가 자동으로 정보를 추출합니다.
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => cardCameraRef.current?.click()}
                      className="flex flex-col items-center gap-2 py-4 bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 rounded-xl hover:bg-sky-100"
                    >
                      <Camera className="h-5 w-5" />
                      <span className="text-sm font-medium">카메라로 촬영</span>
                    </button>
                    <button
                      onClick={() => cardInputRef.current?.click()}
                      className="flex flex-col items-center gap-2 py-4 bg-slate-50 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-600"
                    >
                      <Upload className="h-5 w-5" />
                      <span className="text-sm font-medium">갤러리에서 선택</span>
                    </button>
                  </div>
                </>
              )}

              {cardState === 'processing' && (
                <div className="py-6 text-center space-y-3">
                  {cardPreview && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={cardPreview}
                      alt="명함 미리보기"
                      className="mx-auto max-h-40 rounded-xl object-contain border border-slate-200 dark:border-slate-700"
                    />
                  )}
                  <Loader2 className="mx-auto h-8 w-8 animate-spin text-sky-500" />
                  <p className="text-sm text-slate-500">AI가 명함 정보를 추출하는 중...</p>
                </div>
              )}

              {cardState === 'review' && (
                <div className="space-y-3">
                  {cardPreview && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={cardPreview}
                      alt="명함"
                      className="mx-auto max-h-32 rounded-xl object-contain border border-slate-200 dark:border-slate-700"
                    />
                  )}
                  {cardWarning && (
                    <p className="rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
                      ⚠️ {cardWarning}
                    </p>
                  )}
                  <CardField
                    label="회사명"
                    value={cardForm.company}
                    onChange={(v) => setCardForm((p) => ({ ...p, company: v, name: p.name || v }))}
                  />
                  <CardField
                    label="담당자"
                    value={cardForm.contact_name}
                    onChange={(v) => setCardForm((p) => ({ ...p, contact_name: v }))}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <CardField
                      label="부서"
                      value={cardForm.department}
                      onChange={(v) => setCardForm((p) => ({ ...p, department: v }))}
                    />
                    <CardField
                      label="직책"
                      value={cardForm.position}
                      onChange={(v) => setCardForm((p) => ({ ...p, position: v }))}
                    />
                  </div>
                  <CardField
                    label="전화"
                    value={cardForm.phone}
                    onChange={(v) => setCardForm((p) => ({ ...p, phone: v }))}
                    type="tel"
                  />
                  <CardField
                    label="이메일"
                    value={cardForm.email}
                    onChange={(v) => setCardForm((p) => ({ ...p, email: v }))}
                    type="email"
                  />
                  <CardField
                    label="주소"
                    value={cardForm.address}
                    onChange={(v) => setCardForm((p) => ({ ...p, address: v }))}
                  />
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={saveCardClient}
                      disabled={saving}
                      className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-sky-600 hover:bg-sky-500 py-3 font-medium text-white disabled:opacity-40"
                    >
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                      거래처 등록
                    </button>
                    <button
                      onClick={() => {
                        setCardState('idle')
                        setCardPreview(null)
                      }}
                      className="px-4 py-3 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-sm"
                    >
                      다시 촬영
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {mode === 'EVENT' && (
            <div className="space-y-3">
              <input
                type="text"
                value={eventForm.title}
                onChange={(e) => setEventForm((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="일정 제목 *"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
              <input
                type="datetime-local"
                value={eventForm.startAt}
                onChange={(e) => setEventForm((prev) => ({ ...prev, startAt: e.target.value }))}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
              <input
                type="datetime-local"
                value={eventForm.endAt}
                onChange={(e) => setEventForm((prev) => ({ ...prev, endAt: e.target.value }))}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
              <button
                onClick={saveEvent}
                disabled={saving}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-purple-600 py-3 font-medium text-white transition-colors hover:bg-purple-500 disabled:opacity-40"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calendar className="h-4 w-4" />}
                일정 추가
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  )
}

function CardField({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: 'text' | 'tel' | 'email'
}) {
  return (
    <div className="flex items-center gap-3">
      <label className="text-xs text-slate-500 w-14 flex-shrink-0">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
      />
    </div>
  )
}
