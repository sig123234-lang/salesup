'use client'

import { useMemo, useState } from 'react'
import {
  ClipboardCheck,
  Crown,
  Gauge,
  Loader2,
  Sparkles,
  Target,
  UserCheck,
  Workflow,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Client, MEDDIC } from '@/types'

interface MEDDICWidgetProps {
  client: Client
  onUpdated?: (next: MEDDIC) => void
}

const FIELDS: Array<{
  key: keyof MEDDIC
  label: string
  hint: string
  icon: typeof Gauge
  color: string
}> = [
  { key: 'metrics', label: 'Metrics (성공 지표)', hint: '예: 월 50만원 절감', icon: Gauge, color: 'text-emerald-500' },
  { key: 'economic_buyer', label: 'Economic Buyer', hint: '예: 대표이사 김철수', icon: Crown, color: 'text-amber-500' },
  { key: 'decision_criteria', label: 'Decision Criteria', hint: '예: 가격, 납기, A/S', icon: ClipboardCheck, color: 'text-blue-500' },
  { key: 'decision_process', label: 'Decision Process', hint: '예: 팀장 검토 → 대표 승인', icon: Workflow, color: 'text-purple-500' },
  { key: 'identify_pain', label: 'Identify Pain', hint: '예: 세정제 단가 부담', icon: Target, color: 'text-rose-500' },
  { key: 'champion', label: 'Champion', hint: '예: 관리팀장 박영희', icon: UserCheck, color: 'text-indigo-500' },
]

function extractMEDDIC(custom: unknown): MEDDIC {
  if (!custom || typeof custom !== 'object') return {}
  const meddic = (custom as { meddic?: MEDDIC }).meddic
  return meddic ?? {}
}

function MEDDICWidgetInner({ client, onUpdated }: MEDDICWidgetProps) {
  const supabase = createClient()
  const initial = useMemo(() => extractMEDDIC(client.custom_fields), [client.custom_fields])
  const [form, setForm] = useState<MEDDIC>(initial)
  const [saving, setSaving] = useState(false)
  const [aiLoading, setAILoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const filled = FIELDS.filter((f) => (form[f.key]?.trim()?.length ?? 0) > 0).length
  const progress = Math.round((filled / FIELDS.length) * 100)

  const save = async () => {
    setSaving(true)
    setError(null)
    setMessage(null)
    const nextCustom = {
      ...(client.custom_fields ?? {}),
      meddic: form,
    }
    const { error: updateErr } = await supabase
      .from('clients')
      .update({ custom_fields: nextCustom })
      .eq('id', client.id)
    if (updateErr) {
      setError(updateErr.message)
    } else {
      setMessage('MEDDIC 체크리스트가 저장되었습니다.')
      onUpdated?.(form)
    }
    setSaving(false)
  }

  const autofill = async () => {
    setAILoading(true)
    setError(null)
    setMessage(null)
    try {
      // Pull the most recent call analysis text for this client and ask Claude
      // to extract MEDDIC fields from it.
      const { data: latestCall } = await supabase
        .from('call_records')
        .select('transcript, analysis')
        .eq('client_id', client.id)
        .eq('status', 'COMPLETED')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      const sourceText = [
        latestCall?.transcript,
        latestCall?.analysis?.summary,
        latestCall?.analysis?.customer_reaction,
        client.memo,
      ]
        .filter(Boolean)
        .join('\n\n')

      if (!sourceText) {
        setError('AI가 참고할 통화 기록이나 메모가 없습니다.')
        return
      }

      const res = await fetch('/api/ai/meddic-fill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: client.id, text: sourceText, current: form }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'AI 추출 실패')
      const merged: MEDDIC = { ...form, ...(data.meddic ?? {}) }
      setForm(merged)
      setMessage('AI가 통화 기록에서 항목을 채웠어요. 필요한 부분만 수정하고 저장하세요.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI 자동 추출 실패')
    } finally {
      setAILoading(false)
    }
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 overflow-hidden shadow-sm">
      <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700 flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <ClipboardCheck className="w-4 h-4 text-blue-500" />
            MEDDIC 체크리스트
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">엔터프라이즈 영업 자격 검증 6요소</p>
        </div>
        <div className="text-right">
          <div className="text-xs font-semibold text-blue-600">{progress}%</div>
          <div className="w-20 h-1.5 rounded-full bg-slate-100 dark:bg-slate-700 mt-1 overflow-hidden">
            <div className="h-full bg-blue-500 transition-all" style={{ width: `${progress}%` }} />
          </div>
          <div className="text-[10px] text-slate-400 mt-1">{filled}/6 작성</div>
        </div>
      </div>

      <div className="p-4 space-y-3">
        {FIELDS.map(({ key, label, hint, icon: Icon, color }) => (
          <div key={key}>
            <label className="text-xs text-slate-500 mb-1 flex items-center gap-1.5">
              <Icon className={`w-3.5 h-3.5 ${color}`} />
              {label}
            </label>
            <textarea
              value={form[key] ?? ''}
              onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))}
              rows={2}
              placeholder={hint}
              className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        ))}

        {error && (
          <p className="text-xs text-rose-600 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/30 px-3 py-2 rounded-lg">
            {error}
          </p>
        )}
        {message && (
          <p className="text-xs text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 px-3 py-2 rounded-lg">
            {message}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ClipboardCheck className="w-4 h-4" />}
            저장
          </button>
          <button
            onClick={autofill}
            disabled={aiLoading}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-100 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 text-sm font-medium disabled:opacity-50"
          >
            {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            AI로 자동 채우기
          </button>
        </div>
      </div>
    </div>
  )
}

// Force form state to reset whenever a different client is shown by keying
// the inner component on the client id. Avoids needing a setState-in-effect
// reset for derived initial form values.
export function MEDDICWidget(props: MEDDICWidgetProps) {
  return <MEDDICWidgetInner key={props.client.id} {...props} />
}
