'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Check, Edit3, Trash2, Clock, MapPin, Sparkles, Loader2 } from 'lucide-react'
import Link from 'next/link'
import type { CalendarEvent } from '@/types'
import { sourceStyle } from './eventStyle'
import { createClient } from '@/lib/supabase/client'

interface EventDetailPanelProps {
  event: CalendarEvent
  onClose: () => void
  onChanged: () => void
}

const TYPE_LABEL: Record<CalendarEvent['type'], string> = {
  CALL: '전화',
  VISIT: '방문',
  MEETING: '미팅',
  FOLLOW_UP: '팔로업',
  OTHER: '기타',
}

function toLocalInput(iso: string) {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function buildDraft(event: CalendarEvent) {
  return {
    title: event.title,
    type: event.type,
    start_at: toLocalInput(event.start_at),
    end_at: toLocalInput(event.end_at),
    description: event.description ?? '',
  }
}

export function EventDetailPanel({ event, onClose, onChanged }: EventDetailPanelProps) {
  const supabase = createClient()
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState<'complete' | 'save' | 'delete' | null>(null)
  const [lastEventId, setLastEventId] = useState(event.id)
  const [draft, setDraft] = useState(() => buildDraft(event))

  if (event.id !== lastEventId) {
    setLastEventId(event.id)
    setDraft(buildDraft(event))
    setEditing(false)
  }

  const style = sourceStyle(event)
  const clientName = event.client?.name

  const markComplete = async () => {
    setBusy('complete')
    await supabase
      .from('calendar_events')
      .update({ is_completed: !event.is_completed })
      .eq('id', event.id)
    setBusy(null)
    onChanged()
  }

  const save = async () => {
    setBusy('save')
    await supabase
      .from('calendar_events')
      .update({
        title: draft.title,
        type: draft.type,
        start_at: new Date(draft.start_at).toISOString(),
        end_at: new Date(draft.end_at).toISOString(),
        description: draft.description || null,
      })
      .eq('id', event.id)
    setBusy(null)
    setEditing(false)
    onChanged()
  }

  const remove = async () => {
    if (!confirm('이 일정을 삭제할까요?')) return
    setBusy('delete')
    await supabase.from('calendar_events').delete().eq('id', event.id)
    setBusy(null)
    onChanged()
    onClose()
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
      />
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 26, stiffness: 320 }}
        className="fixed top-0 right-0 bottom-0 w-full max-w-md bg-white dark:bg-slate-900 shadow-xl z-50 flex flex-col"
      >
        <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-700">
          <h3 className="font-semibold text-slate-900 dark:text-white">일정 상세</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center"
          >
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {style && (
            <div className="rounded-xl border border-indigo-200 dark:border-indigo-900 bg-indigo-50/60 dark:bg-indigo-950/30 px-3 py-2 flex items-start gap-2">
              <Sparkles className="w-4 h-4 text-indigo-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">
                  {style.icon} {style.badge}
                </p>
                <p className="text-[11px] text-indigo-600 dark:text-indigo-400 mt-0.5">
                  {style.reason}
                </p>
              </div>
            </div>
          )}

          {!editing ? (
            <>
              <div>
                <p className="text-xs text-slate-500 mb-1">제목</p>
                <p className="text-lg font-semibold text-slate-900 dark:text-white">
                  {event.title}
                </p>
              </div>

              <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                <Clock className="w-4 h-4 text-slate-400" />
                {new Date(event.start_at).toLocaleString('ko-KR', {
                  month: 'short',
                  day: 'numeric',
                  weekday: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
                {' ~ '}
                {new Date(event.end_at).toLocaleTimeString('ko-KR', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-600 dark:text-slate-300">
                  {TYPE_LABEL[event.type]}
                </span>
                {event.is_completed && (
                  <span className="text-xs px-2 py-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 rounded-full">
                    ✅ 완료
                  </span>
                )}
              </div>

              {clientName && event.client_id && (
                <Link
                  href={`/clients/${event.client_id}`}
                  className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:underline"
                >
                  <MapPin className="w-4 h-4" />
                  {clientName}
                </Link>
              )}

              {event.description && (
                <div className="rounded-xl bg-slate-50 dark:bg-slate-800 px-3 py-2.5">
                  <p className="text-xs text-slate-500 mb-1">메모</p>
                  <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-line">
                    {event.description}
                  </p>
                </div>
              )}
            </>
          ) : (
            <div className="space-y-3">
              <Field
                label="제목"
                value={draft.title}
                onChange={(v) => setDraft((d) => ({ ...d, title: v }))}
              />
              <Field
                label="시작"
                type="datetime-local"
                value={draft.start_at}
                onChange={(v) => setDraft((d) => ({ ...d, start_at: v }))}
              />
              <Field
                label="종료"
                type="datetime-local"
                value={draft.end_at}
                onChange={(v) => setDraft((d) => ({ ...d, end_at: v }))}
              />
              <div>
                <label className="text-xs text-slate-500 mb-1 block">유형</label>
                <select
                  value={draft.type}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, type: e.target.value as CalendarEvent['type'] }))
                  }
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-900 dark:text-white"
                >
                  {(Object.keys(TYPE_LABEL) as CalendarEvent['type'][]).map((t) => (
                    <option key={t} value={t}>
                      {TYPE_LABEL[t]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">메모</label>
                <textarea
                  value={draft.description}
                  onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-900 dark:text-white resize-none"
                />
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-slate-100 dark:border-slate-700 flex flex-wrap gap-2">
          {!editing ? (
            <>
              <button
                onClick={markComplete}
                disabled={busy !== null}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-xl disabled:opacity-60"
              >
                {busy === 'complete' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                {event.is_completed ? '완료 취소' : '완료 처리'}
              </button>
              <button
                onClick={() => setEditing(true)}
                className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-medium rounded-xl"
              >
                <Edit3 className="w-4 h-4" />
                수정
              </button>
              <button
                onClick={remove}
                disabled={busy !== null}
                className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-300 text-sm font-medium rounded-xl disabled:opacity-60"
              >
                {busy === 'delete' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                삭제
              </button>
            </>
          ) : (
            <>
              <button
                onClick={save}
                disabled={busy !== null}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-xl disabled:opacity-60"
              >
                {busy === 'save' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                저장
              </button>
              <button
                onClick={() => setEditing(false)}
                className="px-4 py-2.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-medium rounded-xl"
              >
                취소
              </button>
            </>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  )
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: 'text' | 'datetime-local'
}) {
  return (
    <div>
      <label className="text-xs text-slate-500 mb-1 block">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-900 dark:text-white"
      />
    </div>
  )
}
