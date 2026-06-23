'use client'

import { useEffect, useState } from 'react'
import { Calendar, CheckCircle2, Loader2, ClipboardList, AlertTriangle } from 'lucide-react'

type SequenceType = 'hot' | 'standard' | 'nurture' | 'cs'

interface FollowupSequenceCardProps {
  clientId: string
  callRecordId?: string | null
  contractProbability?: number | null
  /** When true, only show CS sequence option (for CONTRACTED clients). */
  csOnly?: boolean
  onSaved?: (count: number) => void
}

interface SequenceStatus {
  total: number
  completed: number
  in_progress: boolean
  steps: Array<{ id: string; title: string; start_at: string; is_completed: boolean }>
}

const OPTIONS: Record<
  SequenceType,
  { icon: string; label: string; description: string; recommendedFor: 'hot' | 'standard' | 'nurture' | 'cs' }
> = {
  hot: {
    icon: '🔥',
    label: '핫 팔로업 — 4회 (1/3/7/14일)',
    description: '계약 확률 70%+ 거래처에 최적',
    recommendedFor: 'hot',
  },
  standard: {
    icon: '📞',
    label: '일반 팔로업 — 5회 (2/5/10/21/30일)',
    description: '연구 기반 표준 시퀀스',
    recommendedFor: 'standard',
  },
  nurture: {
    icon: '🌱',
    label: '장기 육성 — 4회 (7/21/45/90일)',
    description: '계약 확률 40% 미만 거래처에 권장',
    recommendedFor: 'nurture',
  },
  cs: {
    icon: '❤️',
    label: 'CS 사후관리 — 6회 (D+7/30/90/180/270/335)',
    description: '계약 완료 후 갱신/이탈 방지 시퀀스',
    recommendedFor: 'cs',
  },
}

function recommendType(probability: number | null | undefined): SequenceType {
  if (probability == null) return 'standard'
  if (probability >= 70) return 'hot'
  if (probability < 40) return 'nurture'
  return 'standard'
}

export function FollowupSequenceCard({
  clientId,
  callRecordId,
  contractProbability,
  csOnly = false,
  onSaved,
}: FollowupSequenceCardProps) {
  const [status, setStatus] = useState<SequenceStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState<SequenceType | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmOverwrite, setConfirmOverwrite] = useState<SequenceType | null>(null)
  const [savedCount, setSavedCount] = useState<number | null>(null)

  const recommended = csOnly ? 'cs' : recommendType(contractProbability)
  const visibleTypes: SequenceType[] = csOnly ? ['cs'] : ['hot', 'standard', 'nurture']

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const res = await fetch(`/api/ai/followup-sequence?client_id=${clientId}`, {
        cache: 'no-store',
      })
      if (!res.ok) {
        if (!cancelled) setLoading(false)
        return
      }
      const json = (await res.json()) as SequenceStatus
      if (cancelled) return
      setStatus(json)
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [clientId])

  const trigger = async (type: SequenceType, overwrite = false) => {
    setSubmitting(type)
    setError(null)
    const res = await fetch('/api/ai/followup-sequence', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        call_record_id: callRecordId ?? null,
        sequence_type: type,
        overwrite,
      }),
    })
    const data = await res.json()
    setSubmitting(null)

    if (res.status === 409) {
      setConfirmOverwrite(type)
      return
    }
    if (!res.ok) {
      setError(data.error || '저장 실패')
      return
    }
    setSavedCount(data.created ?? 0)
    setConfirmOverwrite(null)
    onSaved?.(data.created ?? 0)
  }

  if (savedCount != null) {
    return (
      <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 rounded-2xl p-4 flex items-center gap-3">
        <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
            팔로업 시퀀스 {savedCount}개 일정이 캘린더에 등록되었습니다.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl p-5 shadow-sm">
      <div className="flex items-start gap-2 mb-3">
        <ClipboardList className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <h3 className="font-semibold text-slate-900 dark:text-white text-sm">
            📋 팔로업 시퀀스 자동 등록
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            이 거래처에 맞는 팔로업 일정을 자동으로 만들어드릴까요?
          </p>
        </div>
      </div>

      {loading ? (
        <div className="h-20 bg-slate-100 dark:bg-slate-700 rounded-xl animate-pulse" />
      ) : status?.in_progress ? (
        <div className="rounded-xl bg-blue-50 dark:bg-blue-950/30 px-3 py-2.5 mb-3 text-xs text-blue-700 dark:text-blue-300">
          진행 중인 시퀀스 ({status.completed}/{status.total} 완료)
        </div>
      ) : null}

      <div className="space-y-2">
        {visibleTypes.map((type) => {
          const opt = OPTIONS[type]
          const isRecommended = type === recommended
          return (
            <button
              key={type}
              onClick={() => trigger(type, false)}
              disabled={submitting !== null}
              className={`w-full text-left px-3 py-2.5 rounded-xl border transition-all disabled:opacity-50 ${
                isRecommended
                  ? 'border-blue-300 bg-blue-50/60 dark:bg-blue-950/30 dark:border-blue-700'
                  : 'border-slate-200 dark:border-slate-700 hover:border-blue-200 hover:bg-slate-50 dark:hover:bg-slate-700/40'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-slate-900 dark:text-white flex items-center gap-2">
                  <span>{opt.icon}</span>
                  {opt.label}
                  {isRecommended && (
                    <span className="text-[10px] bg-blue-600 text-white px-1.5 py-0.5 rounded">
                      추천
                    </span>
                  )}
                </span>
                {submitting === type && (
                  <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                )}
              </div>
              <p className="text-xs text-slate-500 mt-1 ml-6">{opt.description}</p>
            </button>
          )
        })}
      </div>

      <p className="text-[11px] text-slate-400 mt-3 flex items-center gap-1">
        <Calendar className="w-3 h-3" />
        선택 시 모든 일정이 캘린더에 자동 저장됩니다
      </p>

      {error && (
        <p className="text-xs text-rose-600 dark:text-rose-300 mt-2">{error}</p>
      )}

      {confirmOverwrite && (
        <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 p-3">
          <p className="text-xs text-amber-800 dark:text-amber-200 flex items-start gap-2 mb-2">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            이미 진행 중인 시퀀스가 있어요. 기존 일정을 모두 삭제하고 다시 등록할까요?
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => trigger(confirmOverwrite, true)}
              disabled={submitting !== null}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-medium rounded-lg flex items-center gap-1 disabled:opacity-60"
            >
              {submitting && <Loader2 className="w-3 h-3 animate-spin" />}
              덮어쓰기
            </button>
            <button
              onClick={() => setConfirmOverwrite(null)}
              className="px-3 py-1.5 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700"
            >
              취소
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
