'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Mic, Square, Loader2, FileText, UserPlus, Calendar, Send } from 'lucide-react'
import { useQuickCaptureStore } from '@/store'
import type { QuickCaptureMode } from '@/types'

type RecordingState = 'idle' | 'recording' | 'processing' | 'done'
type ActiveQuickCaptureMode = Exclude<QuickCaptureMode['mode'], null>

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
  const [recordingState, setRecordingState] = useState<RecordingState>('idle')
  const [transcript, setTranscript] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [noteText, setNoteText] = useState('')
  const [duration, setDuration] = useState(0)
  const mediaRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<NodeJS.Timeout | null>(null)

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
    close()
  }

  const startRecording = async () => {
    try {
      setErrorMessage(null)
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
      alert('마이크 접근 권한이 필요합니다.')
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

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleClose}
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        />

        {/* Panel */}
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-t-3xl md:rounded-2xl shadow-2xl p-6 z-10"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              {mode === 'VOICE' && <Mic className="w-5 h-5 text-red-500" />}
              {mode === 'NOTE' && <FileText className="w-5 h-5 text-amber-500" />}
              {mode === 'CLIENT' && <UserPlus className="w-5 h-5 text-green-500" />}
              {mode === 'EVENT' && <Calendar className="w-5 h-5 text-purple-500" />}
              <h3 className="font-semibold text-slate-900 dark:text-white">
                {mode === 'VOICE' && '음성 메모'}
                {mode === 'NOTE' && '빠른 메모'}
                {mode === 'CLIENT' && '고객 추가'}
                {mode === 'EVENT' && '일정 추가'}
              </h3>
            </div>
            <button onClick={handleClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* VOICE MODE */}
          {mode === 'VOICE' && (
            <div className="text-center py-4">
              {recordingState === 'idle' && (
                <div>
                  <button
                    onClick={startRecording}
                    className="w-20 h-20 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-red-500/30 transition-all active:scale-95"
                  >
                    <Mic className="w-9 h-9 text-white" />
                  </button>
                  <p className="text-slate-500 mt-4 text-sm">버튼을 눌러 녹음 시작</p>
                </div>
              )}

              {recordingState === 'recording' && (
                <div>
                  <motion.button
                    onClick={stopRecording}
                    animate={{ scale: [1, 1.05, 1] }}
                    transition={{ repeat: Infinity, duration: 1.5 }}
                    className="w-20 h-20 bg-red-500 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-red-500/30 relative"
                  >
                    <div className="absolute inset-0 rounded-full bg-red-400 animate-ping opacity-30" />
                    <Square className="w-8 h-8 text-white" />
                  </motion.button>
                  <p className="text-2xl font-mono text-red-500 mt-4">{formatTime(duration)}</p>
                  <p className="text-slate-500 text-sm">녹음 중... 탭하여 중지</p>
                </div>
              )}

              {recordingState === 'processing' && (
                <div className="py-4">
                  <Loader2 className="w-10 h-10 text-blue-500 animate-spin mx-auto" />
                  <p className="text-slate-500 mt-3 text-sm">AI가 음성을 분석 중...</p>
                </div>
              )}

              {recordingState === 'done' && transcript && (
                <div className="text-left">
                  <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 mb-4">
                    <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{transcript}</p>
                  </div>
                  {errorMessage && (
                    <p className="mb-4 text-sm text-red-500">{errorMessage}</p>
                  )}
                  <button className="w-full py-3 bg-blue-600 text-white rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-blue-500 transition-colors">
                    <Send className="w-4 h-4" />
                    저장하기
                  </button>
                </div>
              )}
            </div>
          )}

          {/* NOTE MODE */}
          {mode === 'NOTE' && (
            <div>
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="메모를 입력하세요..."
                rows={5}
                autoFocus
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none text-sm"
              />
              <button
                disabled={!noteText.trim()}
                className="w-full mt-4 py-3 bg-blue-600 text-white rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-blue-500 disabled:opacity-40 transition-all"
              >
                <Send className="w-4 h-4" />
                저장
              </button>
            </div>
          )}

          {/* CLIENT MODE */}
          {mode === 'CLIENT' && (
            <div className="space-y-3">
              <input
                type="text"
                placeholder="업체명 *"
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
              <input
                type="tel"
                placeholder="전화번호"
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
              <input
                type="text"
                placeholder="주소"
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
              <button className="w-full py-3 bg-green-600 text-white rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-green-500 transition-colors">
                <UserPlus className="w-4 h-4" />
                고객 등록
              </button>
            </div>
          )}

          {/* EVENT MODE */}
          {mode === 'EVENT' && (
            <div className="space-y-3">
              <input
                type="text"
                placeholder="일정 제목 *"
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
              <input
                type="datetime-local"
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
              <button className="w-full py-3 bg-purple-600 text-white rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-purple-500 transition-colors">
                <Calendar className="w-4 h-4" />
                일정 추가
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
