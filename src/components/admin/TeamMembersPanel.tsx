'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Users,
  Phone,
  AlertTriangle,
  Sparkles,
  X,
  TrendingUp,
  Clock,
  Target,
} from 'lucide-react'
import Link from 'next/link'

interface MemberStats {
  total_clients: number
  contracted_this_month: number
  calls_this_week: number
  overdue_followups: number
  high_prob_clients: number
  avg_contract_probability: number
  days_since_last_activity: number | null
  spin_avg_score: number | null
}

type RiskFlag = 'followup_overdue' | 'low_activity' | 'high_prob_neglected'

interface Member {
  id: string
  full_name: string
  avatar_url: string | null
  stats: MemberStats
  risk_flags: RiskFlag[]
}

const RISK_LABEL: Record<RiskFlag, { label: string; tone: string }> = {
  followup_overdue: {
    label: '팔로업 지연',
    tone: 'bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300',
  },
  low_activity: {
    label: '활동 저조',
    tone: 'bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300',
  },
  high_prob_neglected: {
    label: '고확률 방치',
    tone: 'bg-orange-100 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300',
  },
}

interface MemberDetail {
  member: { id: string; full_name: string; avatar_url: string | null }
  activities: Array<{
    id: string
    type: string
    content: string
    created_at: string
    client?: { id: string; name: string } | { id: string; name: string }[] | null
  }>
  risk_clients: Array<{
    id: string
    name: string
    sales_status: string
    contract_probability: number
    last_contacted_at: string | null
    next_contact_at: string | null
  }>
  coaching_point: { praise: string; improvement: string; action: string }
}

export function TeamMembersPanel() {
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Member | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const res = await fetch('/api/admin/team-stats', { cache: 'no-store' })
      if (cancelled) return
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        setError(json.error || '로딩 실패')
        setLoading(false)
        return
      }
      const json = await res.json()
      setMembers((json.members as Member[]) ?? [])
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center gap-2">
        <Users className="w-4 h-4 text-indigo-500" />
        <h2 className="font-semibold text-slate-900 dark:text-white">팀원 현황</h2>
        {!loading && (
          <span className="text-[11px] text-slate-400 font-normal">
            · {members.length}명
          </span>
        )}
      </div>
      <div className="p-4">
        {loading ? (
          <div className="grid sm:grid-cols-2 gap-3">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="h-40 bg-slate-100 dark:bg-slate-700 rounded-xl animate-pulse"
              />
            ))}
          </div>
        ) : error ? (
          <p className="text-sm text-rose-600 dark:text-rose-300 py-6 text-center">
            {error}
          </p>
        ) : members.length === 0 ? (
          <p className="text-sm text-slate-400 py-6 text-center">팀원이 없어요</p>
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {members.map((m) => (
              <article
                key={m.id}
                className="bg-slate-50 dark:bg-slate-700/40 rounded-2xl p-4 space-y-2.5"
              >
                <header className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-slate-600 dark:to-slate-700 flex items-center justify-center font-bold text-blue-600 dark:text-slate-200 text-sm">
                    {m.full_name?.[0] ?? '👤'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                      {m.full_name}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      거래처 {m.stats.total_clients}개 · 이번 달 계약{' '}
                      {m.stats.contracted_this_month}건
                    </p>
                  </div>
                </header>

                <ul className="grid grid-cols-2 gap-1.5 text-[11px]">
                  <Pill icon={<Phone className="w-3 h-3" />} label={`통화 ${m.stats.calls_this_week}/주`} />
                  <Pill
                    icon={<AlertTriangle className="w-3 h-3" />}
                    label={`기한초과 ${m.stats.overdue_followups}`}
                    tone={m.stats.overdue_followups > 0 ? 'amber' : 'slate'}
                  />
                  <Pill
                    icon={<TrendingUp className="w-3 h-3" />}
                    label={`고확률 ${m.stats.high_prob_clients}`}
                  />
                  <Pill
                    icon={<Target className="w-3 h-3" />}
                    label={`SPIN ${m.stats.spin_avg_score ?? '-'}/4`}
                  />
                  <Pill
                    icon={<Clock className="w-3 h-3" />}
                    label={
                      m.stats.days_since_last_activity == null
                        ? '활동 없음'
                        : `최근활동 ${m.stats.days_since_last_activity}일 전`
                    }
                    tone={
                      m.stats.days_since_last_activity == null ||
                      m.stats.days_since_last_activity >= 3
                        ? 'rose'
                        : 'slate'
                    }
                  />
                  <Pill
                    icon={<Sparkles className="w-3 h-3" />}
                    label={`평균확률 ${m.stats.avg_contract_probability}%`}
                  />
                </ul>

                {m.risk_flags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {m.risk_flags.map((f) => (
                      <span
                        key={f}
                        className={`text-[10px] px-2 py-0.5 rounded-full ${RISK_LABEL[f].tone}`}
                      >
                        ⚠️ {RISK_LABEL[f].label}
                      </span>
                    ))}
                  </div>
                )}

                <button
                  onClick={() => setSelected(m)}
                  className="block w-full text-xs text-blue-600 hover:text-blue-500 text-right pt-1"
                >
                  상세 보기 →
                </button>
              </article>
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {selected && (
          <MemberDetailDrawer member={selected} onClose={() => setSelected(null)} />
        )}
      </AnimatePresence>
    </div>
  )
}

function Pill({
  icon,
  label,
  tone = 'slate',
}: {
  icon: React.ReactNode
  label: string
  tone?: 'slate' | 'amber' | 'rose'
}) {
  const tones = {
    slate: 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300',
    amber: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300',
    rose: 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300',
  }[tone]
  return (
    <li className={`flex items-center gap-1 px-2 py-1 rounded-md ${tones}`}>
      {icon}
      <span className="truncate">{label}</span>
    </li>
  )
}

function MemberDetailDrawer({
  member,
  onClose,
}: {
  member: Member
  onClose: () => void
}) {
  const [detail, setDetail] = useState<MemberDetail | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const res = await fetch(`/api/admin/member-detail/${member.id}`, {
        cache: 'no-store',
      })
      if (cancelled) return
      if (res.ok) {
        const json = await res.json()
        setDetail(json as MemberDetail)
      }
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [member.id])

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/30 z-40"
        onClick={onClose}
      />
      <motion.aside
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 26, stiffness: 320 }}
        className="fixed top-0 right-0 bottom-0 w-full max-w-md bg-white dark:bg-slate-900 shadow-2xl z-50 flex flex-col"
      >
        <header className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-700">
          <div className="min-w-0">
            <h3 className="font-semibold text-slate-900 dark:text-white truncate">
              {member.full_name}
            </h3>
            <p className="text-xs text-slate-500">팀원 상세</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {loading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div
                  key={i}
                  className="h-16 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse"
                />
              ))}
            </div>
          ) : !detail ? (
            <p className="text-sm text-slate-400 text-center py-6">
              상세 정보를 가져오지 못했어요.
            </p>
          ) : (
            <>
              <section className="rounded-xl bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-950/30 dark:to-blue-950/30 border border-indigo-100 dark:border-indigo-900 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-4 h-4 text-indigo-500" />
                  <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
                    AI 코칭 포인트
                  </h4>
                </div>
                <p className="text-xs text-emerald-700 dark:text-emerald-300 mb-1">
                  👍 {detail.coaching_point.praise}
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-300 mb-1">
                  ⚠️ {detail.coaching_point.improvement}
                </p>
                <p className="text-xs text-indigo-700 dark:text-indigo-300">
                  → {detail.coaching_point.action}
                </p>
              </section>

              <section>
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                  위험 거래처 ({detail.risk_clients.length})
                </h4>
                {detail.risk_clients.length === 0 ? (
                  <p className="text-xs text-slate-400">위험 거래처가 없어요</p>
                ) : (
                  <ul className="space-y-1.5">
                    {detail.risk_clients.map((c) => (
                      <li key={c.id}>
                        <Link
                          href={`/clients/${c.id}`}
                          className="flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 rounded-lg text-xs"
                        >
                          <span className="text-slate-900 dark:text-white font-medium truncate">
                            {c.name}
                          </span>
                          <span className="text-slate-500 flex-shrink-0">
                            {c.contract_probability}%
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section>
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                  최근 30일 활동 ({detail.activities.length})
                </h4>
                {detail.activities.length === 0 ? (
                  <p className="text-xs text-slate-400">활동 기록이 없어요</p>
                ) : (
                  <ul className="space-y-1.5">
                    {detail.activities.slice(0, 15).map((a) => {
                      const client = Array.isArray(a.client) ? a.client[0] : a.client
                      return (
                        <li
                          key={a.id}
                          className="px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-lg text-xs"
                        >
                          <div className="flex items-center gap-1 text-slate-500 mb-0.5">
                            <span>{typeLabel(a.type)}</span>
                            {client?.name && <span>· {client.name}</span>}
                            <span className="ml-auto">
                              {new Date(a.created_at).toLocaleDateString('ko-KR', {
                                month: 'short',
                                day: 'numeric',
                              })}
                            </span>
                          </div>
                          <p className="text-slate-800 dark:text-slate-200 line-clamp-2">
                            {a.content}
                          </p>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </section>
            </>
          )}
        </div>
      </motion.aside>
    </>
  )
}

function typeLabel(t: string) {
  switch (t) {
    case 'CALL':
      return '📞 통화'
    case 'VISIT':
      return '🚗 방문'
    case 'NOTE':
      return '📝 메모'
    case 'STATUS_CHANGE':
      return '📋 단계 변경'
    case 'AI_INSIGHT':
      return '🤖 AI'
    default:
      return t
  }
}
