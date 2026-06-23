'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Brain,
  Check,
  Headphones,
  Loader2,
  MessageCircle,
  Pin,
  Sparkles,
  X as XIcon,
} from 'lucide-react'
import type { CallAnalysisResult } from '@/types'
import { cn } from '@/lib/utils'

interface CallAnalysisCardProps {
  analysis: CallAnalysisResult
  clientName?: string | null
  showFollowUp?: boolean
}

function SpinPill({ label, active }: { label: string; active: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
        active
          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
          : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500',
      )}
    >
      {active ? <Check className="w-3 h-3" /> : <XIcon className="w-3 h-3" />}
      {label}
    </span>
  )
}

export function CallAnalysisCard({
  analysis,
  clientName,
  showFollowUp = true,
}: CallAnalysisCardProps) {
  const spin = analysis.spin_feedback
  const talk = analysis.talk_listen_estimate
  const salesperson = talk?.salesperson_ratio ?? null
  const customer = salesperson != null ? Math.max(0, 100 - salesperson) : null
  const [scriptState, setScriptState] = useState<'idle' | 'saving' | 'saved'>('idle')

  const saveAsScript = async () => {
    if (!analysis.follow_up_message || scriptState !== 'idle') return
    setScriptState('saving')
    const titleBase = clientName ? `${clientName} 팔로업 멘트` : '팔로업 멘트'
    const res = await fetch('/api/scripts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: titleBase,
        content: analysis.follow_up_message,
        category: 'followup_text',
        tags: ['ai_generated'],
      }),
    })
    setScriptState(res.ok ? 'saved' : 'idle')
    if (res.ok) setTimeout(() => setScriptState('idle'), 2500)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-3"
    >
      {/* Summary card */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Brain className="w-4 h-4 text-purple-500" />
            <h3 className="font-semibold text-slate-900 dark:text-white text-sm">
              AI 분석 결과 {clientName && <span className="text-slate-400">· {clientName}</span>}
            </h3>
          </div>
          <span className="text-xs font-bold text-purple-600">
            {analysis.contract_probability}%
          </span>
        </div>
        <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
          {analysis.summary}
        </p>
        {analysis.customer_reaction && (
          <p className="mt-2 text-xs text-slate-500">반응: {analysis.customer_reaction}</p>
        )}
        {analysis.keywords && analysis.keywords.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {analysis.keywords.map((k) => (
              <span
                key={k}
                className="text-xs bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-full"
              >
                #{k}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* SPIN feedback */}
      {spin && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-blue-500" />
            <h3 className="font-semibold text-slate-900 dark:text-white text-sm">SPIN 분석</h3>
          </div>
          <div className="flex flex-wrap gap-2 mb-3">
            <SpinPill label="S 상황질문" active={!!spin.situation} />
            <SpinPill label="P 문제질문" active={!!spin.problem} />
            <SpinPill label="I 시사질문" active={!!spin.implication} />
            <SpinPill label="N 해결질문" active={!!spin.need_payoff} />
          </div>
          {spin.coaching_tip && (
            <p className="text-xs text-slate-600 dark:text-slate-300 bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900 rounded-xl p-3">
              💡 {spin.coaching_tip}
            </p>
          )}
        </div>
      )}

      {/* Talk-to-listen */}
      {talk && salesperson != null && customer != null && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Headphones className="w-4 h-4 text-amber-500" />
            <h3 className="font-semibold text-slate-900 dark:text-white text-sm">청취 비율</h3>
          </div>
          <div className="flex h-3 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-700 mb-2">
            <div
              className="bg-blue-500 transition-all"
              style={{ width: `${Math.min(100, Math.max(0, salesperson))}%` }}
            />
            <div
              className="bg-emerald-500 transition-all"
              style={{ width: `${Math.min(100, Math.max(0, customer))}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-slate-500 mb-2">
            <span>🎤 영업사원 {salesperson}%</span>
            <span>🦻 고객 {customer}%</span>
          </div>
          {talk.feedback && (
            <p className="text-xs text-slate-600 dark:text-slate-300">
              {salesperson > 60 ? '⚠️ ' : ''}
              {talk.feedback}
            </p>
          )}
        </div>
      )}

      {/* Recommended actions */}
      {analysis.recommended_actions && analysis.recommended_actions.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-5 shadow-sm">
          <h3 className="font-semibold text-slate-900 dark:text-white text-sm mb-3">
            ✅ 추천 액션
          </h3>
          <ul className="space-y-2">
            {analysis.recommended_actions.map((a, i) => (
              <li
                key={i}
                className="flex gap-2 text-sm text-slate-700 dark:text-slate-300"
              >
                <span className="text-blue-500 font-bold flex-shrink-0">{i + 1}.</span>
                <span>{a}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Follow-up message */}
      {showFollowUp && analysis.follow_up_message && (
        <div className="bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-950/30 dark:to-blue-950/30 rounded-2xl border border-indigo-100 dark:border-indigo-900 p-5">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-indigo-500" />
              <h3 className="font-semibold text-slate-900 dark:text-white text-sm">
                팔로업 멘트
              </h3>
            </div>
            <button
              onClick={saveAsScript}
              disabled={scriptState !== 'idle'}
              className={cn(
                'flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg transition-colors',
                scriptState === 'saved'
                  ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                  : 'bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900',
              )}
            >
              {scriptState === 'saving' ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : scriptState === 'saved' ? (
                <Check className="w-3 h-3" />
              ) : (
                <Pin className="w-3 h-3" />
              )}
              {scriptState === 'saved' ? '저장됨' : '스크립트에 저장'}
            </button>
          </div>
          <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">
            {analysis.follow_up_message}
          </p>
        </div>
      )}
    </motion.div>
  )
}
