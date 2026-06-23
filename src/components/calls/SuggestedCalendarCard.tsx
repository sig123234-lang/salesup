'use client'

import { useState } from 'react'
import { Calendar, CheckCircle2, Loader2, Sparkles, X } from 'lucide-react'
import type { CallAnalysisResult } from '@/types'

interface SuggestedCalendarCardProps {
  callRecordId: string | null
  clientId: string | null
  suggestion: NonNullable<CallAnalysisResult['next_calendar_event']>
  reminders?: CallAnalysisResult['cs_reminders']
  onSaved: (eventCount: number) => void
  onDismiss: () => void
}

function toLocalInputValue(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function SuggestedCalendarCard({
  callRecordId,
  clientId,
  suggestion,
  reminders,
  onSaved,
  onDismiss,
}: SuggestedCalendarCardProps) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(suggestion.title || '후속 연락')
  const [start, setStart] = useState(toLocalInputValue(suggestion.suggested_start))
  const [end, setEnd] = useState(toLocalInputValue(suggestion.suggested_end))
  const [type, setType] = useState(suggestion.type || 'FOLLOW_UP')
  const [saving, setSaving] = useState(false)
  const [savedCount, setSavedCount] = useState<number | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const reminderCount = reminders?.length ?? 0

  const handleSave = async () => {
    if (!start) {
      setErrorMsg('일정 시작 시간을 입력해주세요.')
      return
    }
    setSaving(true)
    setErrorMsg(null)
    try {
      const res = await fetch('/api/ai/calendar-from-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          call_record_id: callRecordId,
          client_id: clientId,
          override_event: {
            ...suggestion,
            title,
            type,
            suggested_start: new Date(start).toISOString(),
            suggested_end: end ? new Date(end).toISOString() : null,
          },
          include_reminders: true,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '저장에 실패했습니다.')
      setSavedCount(data.created ?? 0)
      onSaved(data.created ?? 0)
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  if (savedCount != null) {
    return (
      <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 rounded-2xl p-4 flex items-center gap-3">
        <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
            캘린더에 {savedCount}개 일정이 저장되었습니다.
          </p>
          {reminderCount > 0 && (
            <p className="text-xs text-emerald-700/80 dark:text-emerald-400 mt-0.5">
              CS 리마인더 {reminderCount}개 포함
            </p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border border-blue-200 dark:border-blue-900 rounded-2xl p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-start gap-2 flex-1">
          <Sparkles className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-white text-sm">
              📅 AI가 다음 일정을 감지했어요
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {suggestion.is_confirmed ? '✅ 통화에서 약속됨' : '⚠️ AI 추천 일정'}
            </p>
          </div>
        </div>
        <button
          onClick={onDismiss}
          className="text-slate-400 hover:text-slate-600 p-1"
          aria-label="dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {!editing ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl p-3 mb-3 space-y-1 text-sm">
          <p className="font-medium text-slate-900 dark:text-white">{title}</p>
          <p className="text-xs text-slate-500">
            {start
              ? new Date(start).toLocaleString('ko-KR', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : '시간 미정'}
            <span className="ml-2 text-blue-600">· {type}</span>
          </p>
          {suggestion.notes && (
            <p className="text-xs text-slate-500 mt-1">{suggestion.notes}</p>
          )}
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-xl p-3 mb-3 space-y-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white"
            placeholder="제목"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              type="datetime-local"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className="px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white"
            />
            <input
              type="datetime-local"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              className="px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white"
            />
          </div>
          <select
            value={type}
            onChange={(e) =>
              setType(e.target.value as 'CALL' | 'VISIT' | 'MEETING' | 'FOLLOW_UP')
            }
            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white"
          >
            <option value="CALL">전화</option>
            <option value="VISIT">방문</option>
            <option value="MEETING">미팅</option>
            <option value="FOLLOW_UP">팔로업</option>
          </select>
        </div>
      )}

      {reminderCount > 0 && (
        <p className="text-xs text-blue-700 dark:text-blue-300 bg-white/60 dark:bg-blue-950/40 rounded-lg px-3 py-2 mb-3">
          🤖 CS 리마인더 {reminderCount}개도 함께 등록됩니다 (계약 완료 감지)
        </p>
      )}

      {errorMsg && (
        <p className="text-xs text-rose-600 dark:text-rose-300 mb-2">{errorMsg}</p>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-lg disabled:opacity-60"
        >
          {saving ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Calendar className="w-3.5 h-3.5" />
          )}
          캘린더에 저장
        </button>
        <button
          onClick={() => setEditing((v) => !v)}
          className="px-3 py-2 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700"
        >
          {editing ? '미리보기' : '수정'}
        </button>
        <button
          onClick={onDismiss}
          className="px-3 py-2 text-slate-500 text-xs font-medium rounded-lg hover:bg-white/60 dark:hover:bg-slate-800/60"
        >
          건너뛰기
        </button>
      </div>
    </div>
  )
}
