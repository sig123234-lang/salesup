'use client'

import { useCallback, useMemo, useState } from 'react'
import {
  ChevronDown,
  ChevronUp,
  Loader2,
  Plus,
  RefreshCcw,
  Trash2,
} from 'lucide-react'
import type { CallAnalysisResult, VisitAnalysisResult, SalesStatus } from '@/types'
import { CallAnalysisCard } from '@/components/calls/CallAnalysisCard'
import { SALES_STATUS_CONFIG, formatRelativeTime } from '@/lib/utils'

type ActivityType = 'NOTE' | 'CALL' | 'VISIT' | 'EMAIL' | 'STATUS_CHANGE' | 'AI_INSIGHT'

interface TimelineActivity {
  id: string
  type: ActivityType
  content: string
  metadata: Record<string, unknown> | null
  created_at: string
  user?: { full_name?: string | null; avatar_url?: string | null } | null
  call?: {
    id: string
    analysis: CallAnalysisResult | null
    duration_seconds: number | null
    created_at: string
  } | null
  visit?: {
    id: string
    analysis: VisitAnalysisResult | null
    started_at: string
    ended_at: string | null
  } | null
}

interface ActivityTimelineProps {
  clientId: string
  clientName?: string | null
}

const TYPE_META: Record<
  ActivityType,
  { icon: string; label: string; tone: string }
> = {
  CALL: { icon: '📞', label: '통화', tone: 'bg-blue-50 dark:bg-blue-950/40' },
  VISIT: { icon: '🚗', label: '방문', tone: 'bg-green-50 dark:bg-green-950/40' },
  NOTE: { icon: '📝', label: '메모', tone: 'bg-slate-50 dark:bg-slate-700/40' },
  EMAIL: { icon: '✉️', label: '이메일', tone: 'bg-purple-50 dark:bg-purple-950/40' },
  STATUS_CHANGE: {
    icon: '📋',
    label: '단계 변경',
    tone: 'bg-amber-50 dark:bg-amber-950/40',
  },
  AI_INSIGHT: {
    icon: '🤖',
    label: 'AI 인사이트',
    tone: 'bg-indigo-50 dark:bg-indigo-950/40',
  },
}

function groupKey(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yest = new Date(start)
  yest.setDate(yest.getDate() - 1)
  const weekStart = new Date(start)
  weekStart.setDate(weekStart.getDate() - 6)

  if (d >= start) return '오늘'
  if (d >= yest) return '어제'
  if (d >= weekStart) return '이번 주'
  return '이전'
}

export function ActivityTimeline({ clientId, clientName }: ActivityTimelineProps) {
  const [items, setItems] = useState<TimelineActivity[]>([])
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [noteText, setNoteText] = useState('')
  const [savingNote, setSavingNote] = useState(false)
  const [reanalyzing, setReanalyzing] = useState<string | null>(null)

  const fetchPage = useCallback(
    async (nextOffset: number, append: boolean) => {
      setLoading(true)
      const res = await fetch(
        `/api/clients/${clientId}/activities?limit=20&offset=${nextOffset}`,
        { cache: 'no-store' },
      )
      const json = await res.json()
      setLoading(false)
      if (!res.ok) return
      const data = (json.data ?? []) as TimelineActivity[]
      setItems((prev) => (append ? [...prev, ...data] : data))
      setHasMore(json.has_more === true)
      setOffset(nextOffset + data.length)
    },
    [clientId],
  )

  const [lastFetchedClientId, setLastFetchedClientId] = useState<string | null>(null)
  if (lastFetchedClientId !== clientId) {
    setLastFetchedClientId(clientId)
    setItems([])
    setOffset(0)
    void fetchPage(0, false)
  }

  const grouped = useMemo(() => {
    const order = ['오늘', '어제', '이번 주', '이전']
    const buckets: Record<string, TimelineActivity[]> = {
      오늘: [],
      어제: [],
      '이번 주': [],
      이전: [],
    }
    for (const it of items) buckets[groupKey(it.created_at)].push(it)
    return order
      .map((k) => ({ label: k, items: buckets[k] }))
      .filter((g) => g.items.length > 0)
  }, [items])

  const addNote = async () => {
    if (!noteText.trim()) return
    setSavingNote(true)
    const res = await fetch(`/api/clients/${clientId}/activities`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: noteText.trim() }),
    })
    setSavingNote(false)
    if (res.ok) {
      setNoteText('')
      setOffset(0)
      void fetchPage(0, false)
    }
  }

  const remove = async (id: string) => {
    if (!confirm('이 활동을 삭제할까요?')) return
    const res = await fetch(
      `/api/clients/${clientId}/activities?activity_id=${id}`,
      { method: 'DELETE' },
    )
    if (res.ok) setItems((prev) => prev.filter((x) => x.id !== id))
  }

  const reanalyze = async (callId: string, activityId: string) => {
    setReanalyzing(activityId)
    try {
      const res = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ call_id: callId, force: true }),
      })
      if (res.ok) void fetchPage(0, false)
    } finally {
      setReanalyzing(null)
    }
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700">
        <h3 className="font-semibold text-slate-900 dark:text-white text-sm">활동 타임라인</h3>
      </div>

      <div className="p-5 space-y-5">
        <div className="flex gap-2">
          <input
            type="text"
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="메모 추가..."
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void addNote()
              }
            }}
            className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={addNote}
            disabled={!noteText.trim() || savingNote}
            className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg flex items-center gap-1 disabled:opacity-40"
          >
            {savingNote ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Plus className="w-3.5 h-3.5" />
            )}
            추가
          </button>
        </div>

        {loading && items.length === 0 ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="h-16 bg-slate-100 dark:bg-slate-700 rounded-xl animate-pulse"
              />
            ))}
          </div>
        ) : grouped.length === 0 ? (
          <p className="text-center text-sm text-slate-400 py-6">활동 기록이 없습니다</p>
        ) : (
          <div className="space-y-6">
            {grouped.map((group) => (
              <section key={group.label}>
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                  {group.label}
                </h4>
                <div className="space-y-2">
                  {group.items.map((it) => (
                    <TimelineRow
                      key={it.id}
                      item={it}
                      clientName={clientName ?? null}
                      isExpanded={!!expanded[it.id]}
                      onToggle={() =>
                        setExpanded((m) => ({ ...m, [it.id]: !m[it.id] }))
                      }
                      onDelete={() => remove(it.id)}
                      onReanalyze={(callId) => reanalyze(callId, it.id)}
                      reanalyzing={reanalyzing === it.id}
                    />
                  ))}
                </div>
              </section>
            ))}

            {hasMore && (
              <button
                onClick={() => void fetchPage(offset, true)}
                disabled={loading}
                className="block w-full text-center py-2 text-sm text-blue-600 hover:text-blue-500 disabled:opacity-50"
              >
                {loading ? '불러오는 중...' : '더 보기'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function TimelineRow({
  item,
  clientName,
  isExpanded,
  onToggle,
  onDelete,
  onReanalyze,
  reanalyzing,
}: {
  item: TimelineActivity
  clientName: string | null
  isExpanded: boolean
  onToggle: () => void
  onDelete: () => void
  onReanalyze: (callId: string) => void
  reanalyzing: boolean
}) {
  const meta = TYPE_META[item.type] ?? TYPE_META.NOTE
  const expandable =
    (item.type === 'CALL' && !!item.call?.analysis) ||
    (item.type === 'VISIT' && !!item.visit?.analysis)
  const canReanalyze = item.type === 'CALL' && !!item.call?.id

  return (
    <div className={`rounded-xl ${meta.tone} p-3`}>
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-white dark:bg-slate-900 flex items-center justify-center text-base flex-shrink-0 shadow-sm">
          {meta.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300">
              {meta.label}
            </span>
            <span className="text-[11px] text-slate-400">
              {formatRelativeTime(item.created_at)}
            </span>
            {item.user?.full_name && (
              <span className="text-[11px] text-slate-400">· {item.user.full_name}</span>
            )}
          </div>
          {item.type === 'STATUS_CHANGE' ? (
            <StatusChangeRow content={item.content} metadata={item.metadata} />
          ) : (
            <p className="text-sm text-slate-700 dark:text-slate-300 mt-1 leading-relaxed whitespace-pre-line">
              {item.content}
            </p>
          )}

          {expandable && (
            <button
              onClick={onToggle}
              className="mt-2 text-xs text-blue-600 dark:text-blue-300 hover:underline flex items-center gap-1"
            >
              {isExpanded ? (
                <>
                  <ChevronUp className="w-3 h-3" />
                  분석 접기
                </>
              ) : (
                <>
                  <ChevronDown className="w-3 h-3" />
                  분석 펼치기
                </>
              )}
            </button>
          )}

          {isExpanded && item.type === 'CALL' && item.call?.analysis && (
            <div className="mt-3">
              <CallAnalysisCard analysis={item.call.analysis} clientName={clientName} />
            </div>
          )}
          {isExpanded && item.type === 'VISIT' && item.visit?.analysis && (
            <div className="mt-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 p-4 space-y-2 text-sm">
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                {item.visit.analysis.summary}
              </p>
              {item.visit.analysis.next_actions?.length > 0 && (
                <ul className="space-y-1">
                  {item.visit.analysis.next_actions.map((a, i) => (
                    <li
                      key={i}
                      className="text-xs text-slate-600 dark:text-slate-300 flex items-start gap-1"
                    >
                      <span className="text-blue-500">{i + 1}.</span>
                      <span>{a}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {(item.type === 'CALL' || item.type === 'VISIT') && (
          <div className="flex items-center gap-1 flex-shrink-0">
            {canReanalyze && (
              <button
                onClick={() => onReanalyze(item.call!.id)}
                disabled={reanalyzing}
                className="p-1.5 text-slate-400 hover:text-blue-600 disabled:opacity-50"
                aria-label="reanalyze"
              >
                {reanalyzing ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RefreshCcw className="w-3.5 h-3.5" />
                )}
              </button>
            )}
            <button
              onClick={onDelete}
              className="p-1.5 text-slate-400 hover:text-rose-600"
              aria-label="delete"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
        {item.type === 'NOTE' && (
          <button
            onClick={onDelete}
            className="p-1.5 text-slate-400 hover:text-rose-600 flex-shrink-0"
            aria-label="delete"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  )
}

function StatusChangeRow({
  content,
  metadata,
}: {
  content: string
  metadata: Record<string, unknown> | null
}) {
  const meta = (metadata ?? {}) as Record<string, unknown>
  const from = (meta.from ?? meta.previous ?? null) as SalesStatus | null
  const to = (meta.to ?? meta.new_status ?? meta.status ?? null) as SalesStatus | null
  if (!from && !to) {
    return (
      <p className="text-sm text-slate-700 dark:text-slate-300 mt-1 leading-relaxed">
        {content}
      </p>
    )
  }
  const fromCfg = from ? SALES_STATUS_CONFIG[from] : null
  const toCfg = to ? SALES_STATUS_CONFIG[to] : null
  return (
    <div className="mt-1 flex items-center gap-2 text-sm">
      {fromCfg && (
        <span className={`text-xs px-2 py-0.5 rounded-full ${fromCfg.bg} ${fromCfg.color}`}>
          {fromCfg.emoji} {fromCfg.label}
        </span>
      )}
      <span className="text-slate-400">→</span>
      {toCfg && (
        <span className={`text-xs px-2 py-0.5 rounded-full ${toCfg.bg} ${toCfg.color}`}>
          {toCfg.emoji} {toCfg.label}
        </span>
      )}
    </div>
  )
}
