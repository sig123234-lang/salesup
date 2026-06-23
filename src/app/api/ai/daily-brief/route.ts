import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { jsonCompletion } from '@/lib/ai/unified'
import type { Client, Profile } from '@/types'

type EventRow = {
  id: string
  title: string
  type: 'CALL' | 'VISIT' | 'MEETING' | 'FOLLOW_UP' | 'OTHER'
  start_at: string
  client: { id: string; name: string } | { id: string; name: string }[] | null
}

function pickClient(c: EventRow['client']): { id: string; name: string } | null {
  if (!c) return null
  if (Array.isArray(c)) return c[0] ?? null
  return c
}

interface BriefAction {
  priority: number
  icon: string
  title: string
  reason: string
  action: string
  client_id: string | null
}

interface BriefStats {
  scheduled_calls: number
  overdue_followups: number
  high_prob_clients: number
}

interface DailyBrief {
  greeting: string
  top_actions: BriefAction[]
  today_stats: BriefStats
  motivation: string
}

interface CachedBrief {
  date: string
  data: DailyBrief
}

function todayKey(date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function startOfPrevMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() - 1, 1)
}

const SYSTEM_PROMPT = `당신은 영업사원의 하루를 코칭하는 AI입니다.
오늘 데이터를 분석해 "지금 당장 실행해야 할 TOP 3 액션"을 우선순위 순서로 추천하세요.

판단 기준:
1. 계약 확률 70% 이상이면서 마지막 통화 반응이 긍정적 → 최우선 (클로징 임박)
2. 기한 초과된 follow-up → 잊혀지면 거래 사망. 즉시 처리
3. 7일 이상 미연락 CONTRACTED 고객 → CS 이탈 위험
4. 오늘 예정된 일정 → 준비 필요
5. 신규 리드 발굴은 후순위 (위 항목 없을 때만)

응답은 반드시 다음 JSON 형식 (마크다운/코드블럭 없이 JSON만):
{
  "greeting": "이름으로 시작하는 친근한 한 문장 (이모지 1~2개)",
  "top_actions": [
    {
      "priority": 1,
      "icon": "🔥|⏰|💎|🎯|📞|💌",
      "title": "거래처명 + 핵심 액션 (예: A사 계약 마무리)",
      "reason": "왜 지금 해야 하는지 한 문장",
      "action": "구체적으로 무엇을 (예: 오늘 오전 중 계약서 발송)",
      "client_id": "관련 거래처 UUID 또는 null"
    }
  ],
  "today_stats": {
    "scheduled_calls": number,
    "overdue_followups": number,
    "high_prob_clients": number
  },
  "motivation": "오늘 하루 동기 부여 한 문장 (수치 기반이면 더 좋음)"
}

규칙:
- top_actions는 정확히 3개
- client_id는 입력 데이터의 거래처 UUID 그대로 사용, 해당 없으면 null
- title/reason/action 모두 한국어, 영업 현장 톤
- 데이터가 비면 신규 발굴/리서치를 권장하는 액션으로 채움`

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const force = url.searchParams.get('force') === '1'
  const today = todayKey()

  const { data: profileRow } = await supabase
    .from('profiles')
    .select('id, full_name, metadata')
    .eq('id', user.id)
    .single()

  const profile = profileRow as Pick<Profile, 'id' | 'full_name' | 'metadata'> | null
  const cached = (profile?.metadata as Record<string, unknown> | undefined)
    ?.daily_brief_cache as CachedBrief | undefined

  if (!force && cached?.date === today && cached.data) {
    return NextResponse.json({
      data: cached.data,
      cached: true,
      fallback: 'none',
      stale_cache_date: null,
    })
  }

  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const tomorrowStart = new Date(todayStart)
  tomorrowStart.setDate(tomorrowStart.getDate() + 1)
  const sevenDaysAgo = new Date(now)
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  const monthStart = startOfMonth(now)
  const prevMonthStart = startOfPrevMonth(now)

  const [
    todayEventsRes,
    overdueRes,
    highProbRes,
    csRiskRes,
    thisMonthRes,
    lastMonthRes,
  ] = await Promise.all([
    supabase
      .from('calendar_events')
      .select('id, title, type, start_at, client:clients(id, name)')
      .eq('user_id', user.id)
      .gte('start_at', todayStart.toISOString())
      .lt('start_at', tomorrowStart.toISOString())
      .order('start_at', { ascending: true })
      .limit(10),
    supabase
      .from('clients')
      .select('id, name, sales_status, contract_probability, last_contacted_at, next_contact_at')
      .eq('owner_id', user.id)
      .lt('next_contact_at', now.toISOString())
      .neq('sales_status', 'CONTRACTED')
      .neq('sales_status', 'REJECTED')
      .order('next_contact_at', { ascending: true })
      .limit(15),
    supabase
      .from('clients')
      .select('id, name, sales_status, contract_probability, last_contacted_at')
      .eq('owner_id', user.id)
      .gte('contract_probability', 70)
      .neq('sales_status', 'CONTRACTED')
      .neq('sales_status', 'REJECTED')
      .order('contract_probability', { ascending: false })
      .limit(10),
    supabase
      .from('clients')
      .select('id, name, last_contacted_at')
      .eq('owner_id', user.id)
      .eq('sales_status', 'CONTRACTED')
      .or(`last_contacted_at.is.null,last_contacted_at.lt.${sevenDaysAgo.toISOString()}`)
      .order('last_contacted_at', { ascending: true, nullsFirst: true })
      .limit(10),
    supabase
      .from('clients')
      .select('id', { count: 'exact', head: true })
      .eq('owner_id', user.id)
      .eq('sales_status', 'CONTRACTED')
      .gte('updated_at', monthStart.toISOString()),
    supabase
      .from('clients')
      .select('id', { count: 'exact', head: true })
      .eq('owner_id', user.id)
      .eq('sales_status', 'CONTRACTED')
      .gte('updated_at', prevMonthStart.toISOString())
      .lt('updated_at', monthStart.toISOString()),
  ])

  const todayEvents = ((todayEventsRes.data ?? []) as unknown as EventRow[]).map((e) => ({
    id: e.id,
    title: e.title,
    type: e.type,
    start_at: e.start_at,
    client: pickClient(e.client),
  }))
  const overdue = (overdueRes.data ?? []) as Pick<
    Client,
    'id' | 'name' | 'sales_status' | 'contract_probability' | 'last_contacted_at' | 'next_contact_at'
  >[]
  const highProb = (highProbRes.data ?? []) as Pick<
    Client,
    'id' | 'name' | 'sales_status' | 'contract_probability' | 'last_contacted_at'
  >[]
  const csRisk = (csRiskRes.data ?? []) as Pick<Client, 'id' | 'name' | 'last_contacted_at'>[]
  const thisMonthCount = thisMonthRes.count ?? 0
  const lastMonthCount = lastMonthRes.count ?? 0

  const stats: BriefStats = {
    scheduled_calls: todayEvents.filter((e) => e.type === 'CALL').length,
    overdue_followups: overdue.length,
    high_prob_clients: highProb.length,
  }

  const userPrompt = JSON.stringify({
    today: today,
    user_name: profile?.full_name ?? '영업사원',
    today_events: todayEvents.map((e) => ({
      title: e.title,
      type: e.type,
      time: e.start_at,
      client: e.client?.name ?? null,
      client_id: e.client?.id ?? null,
    })),
    overdue_followups: overdue.map((c) => ({
      client_id: c.id,
      name: c.name,
      status: c.sales_status,
      probability: c.contract_probability,
      next_contact_at: c.next_contact_at,
      last_contacted_at: c.last_contacted_at,
    })),
    high_probability_clients: highProb.map((c) => ({
      client_id: c.id,
      name: c.name,
      status: c.sales_status,
      probability: c.contract_probability,
      last_contacted_at: c.last_contacted_at,
    })),
    cs_risk_clients: csRisk.map((c) => ({
      client_id: c.id,
      name: c.name,
      last_contacted_at: c.last_contacted_at,
    })),
    contracts_this_month: thisMonthCount,
    contracts_last_month: lastMonthCount,
    stats,
  })

  function ruleBasedBrief(): DailyBrief {
    const actions: BriefAction[] = []
    if (overdue.length > 0) {
      const c = overdue[0]
      actions.push({
        priority: actions.length + 1,
        icon: '⏰',
        title: `${c.name} 팔로업`,
        reason: `예정된 연락일이 지난 거래처입니다 (확률 ${c.contract_probability}%)`,
        action: '오늘 중 전화 또는 문자 전송',
        client_id: c.id,
      })
    }
    if (highProb.length > 0) {
      const c = highProb[0]
      actions.push({
        priority: actions.length + 1,
        icon: '🔥',
        title: `${c.name} 클로징`,
        reason: `계약 확률 ${c.contract_probability}% — 즉시 클로징 기회`,
        action: '제안서/계약서 검토 요청',
        client_id: c.id,
      })
    }
    if (csRisk.length > 0) {
      const c = csRisk[0]
      actions.push({
        priority: actions.length + 1,
        icon: '❤️',
        title: `${c.name} CS 점검`,
        reason: '계약 후 장기 미연락 — 이탈 위험',
        action: 'CS 안부 연락',
        client_id: c.id,
      })
    }
    if (actions.length === 0 && todayEvents.length > 0) {
      const e = todayEvents[0]
      actions.push({
        priority: 1,
        icon: '📞',
        title: e.client?.name || e.title,
        reason: '오늘 예정된 일정',
        action: '일정 준비 및 진행',
        client_id: e.client?.id ?? null,
      })
    }
    return {
      greeting: `좋은 아침이에요, ${profile?.full_name ?? '영업사원'}님 👋`,
      top_actions: actions.slice(0, 3),
      today_stats: stats,
      motivation:
        thisMonthCount > lastMonthCount
          ? `이번 달 ${thisMonthCount}건, 지난 달 대비 ${thisMonthCount - lastMonthCount}건 증가 중이에요!`
          : '오늘도 한 건씩 차곡차곡 쌓아봐요.',
    }
  }

  let brief: DailyBrief | null = null
  let fallback: 'none' | 'stale_cache' | 'rule_based' = 'none'

  try {
    const result = await jsonCompletion<DailyBrief>({
      task: 'recommend',
      systemPrompt: SYSTEM_PROMPT,
      userPrompt,
      maxTokens: 1500,
      temperature: 0.4,
    })
    brief = {
      greeting: result.data.greeting,
      top_actions: (result.data.top_actions ?? []).slice(0, 3).map((a, i) => ({
        priority: a.priority ?? i + 1,
        icon: a.icon ?? '🎯',
        title: a.title ?? '',
        reason: a.reason ?? '',
        action: a.action ?? '',
        client_id: a.client_id ?? null,
      })),
      today_stats: stats,
      motivation: result.data.motivation ?? '',
    }
  } catch (err) {
    console.error('daily-brief AI error:', err)
    if (cached?.data) {
      brief = cached.data
      fallback = 'stale_cache'
    } else {
      brief = ruleBasedBrief()
      fallback = 'rule_based'
    }
  }

  // Persist cache only when the brief came from a successful AI call.
  if (fallback === 'none') {
    const nextMeta = {
      ...((profile?.metadata as Record<string, unknown>) ?? {}),
      daily_brief_cache: { date: today, data: brief },
    }
    await supabase.from('profiles').update({ metadata: nextMeta }).eq('id', user.id)
  }

  const staleDate = fallback === 'stale_cache' ? cached?.date ?? null : null
  return NextResponse.json({
    data: brief,
    cached: false,
    fallback,
    stale_cache_date: staleDate,
  })
}
