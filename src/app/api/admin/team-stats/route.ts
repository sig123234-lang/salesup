import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { CallAnalysisResult } from '@/types'

interface MemberStats {
  total_clients: number
  contracted_this_month: number
  calls_this_week: number
  overdue_followups: number
  high_prob_clients: number
  avg_contract_probability: number
  days_since_last_activity: number | null
  spin_avg_score: number | null // 0..4
}

interface Member {
  id: string
  full_name: string
  avatar_url: string | null
  stats: MemberStats
  risk_flags: Array<'followup_overdue' | 'low_activity' | 'high_prob_neglected'>
}

interface TeamTotals {
  members: number
  clients: number
  contracted_this_month: number
  calls_this_week: number
  overdue_followups: number
}

const DAY = 24 * 60 * 60 * 1000

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}
function startOfWeek(d: Date) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  x.setDate(x.getDate() - x.getDay())
  return x
}

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, company_id')
    .eq('id', user.id)
    .single()
  if (!profile) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (profile.role !== 'COMPANY_ADMIN' && profile.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (!profile.company_id) {
    return NextResponse.json({ error: 'No company associated' }, { status: 400 })
  }
  const companyId = profile.company_id

  const now = new Date()
  const monthStart = startOfMonth(now)
  const weekStart = startOfWeek(now)
  const threeDaysAgo = new Date(now.getTime() - 3 * DAY)
  const sevenDaysAgo = new Date(now.getTime() - 7 * DAY)

  const [
    membersRes,
    clientsRes,
    callsThisWeekRes,
    callsForSpinRes,
    recentActivitiesRes,
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, full_name, avatar_url')
      .eq('company_id', companyId),
    supabase
      .from('clients')
      .select(
        'id, owner_id, sales_status, contract_probability, next_contact_at, last_contacted_at, updated_at',
      )
      .eq('company_id', companyId),
    supabase
      .from('call_records')
      .select('user_id, created_at')
      .eq('company_id', companyId)
      .gte('created_at', weekStart.toISOString()),
    supabase
      .from('call_records')
      .select('user_id, analysis, created_at')
      .eq('company_id', companyId)
      .not('analysis', 'is', null)
      .order('created_at', { ascending: false })
      .limit(500),
    supabase
      .from('activities')
      .select('user_id, created_at')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(500),
  ])

  const members = (membersRes.data ?? []) as Array<{
    id: string
    full_name: string
    avatar_url: string | null
  }>
  const clients = clientsRes.data ?? []
  const callsThisWeek = callsThisWeekRes.data ?? []
  const callsForSpin = callsForSpinRes.data ?? []
  const recentActivities = recentActivitiesRes.data ?? []

  function spinScore(analysis: CallAnalysisResult): number {
    const s = analysis.spin_feedback
    if (!s) return 0
    let n = 0
    if (s.situation) n++
    if (s.problem) n++
    if (s.implication) n++
    if (s.need_payoff) n++
    return n
  }

  const out: Member[] = members.map((m) => {
    const myClients = clients.filter((c) => c.owner_id === m.id)
    const myCallsWeek = callsThisWeek.filter((c) => c.user_id === m.id)
    const mySpinCalls = callsForSpin
      .filter((c) => c.user_id === m.id)
      .slice(0, 20)
    const myActivities = recentActivities.filter((a) => a.user_id === m.id)

    const overdueFollowups = myClients.filter(
      (c) =>
        c.next_contact_at &&
        new Date(c.next_contact_at) <= now &&
        c.sales_status !== 'CONTRACTED' &&
        c.sales_status !== 'REJECTED',
    ).length

    const highProbClients = myClients.filter(
      (c) =>
        c.contract_probability >= 70 &&
        c.sales_status !== 'CONTRACTED' &&
        c.sales_status !== 'REJECTED',
    )

    const probSum = myClients.reduce(
      (acc, c) => acc + (c.contract_probability ?? 0),
      0,
    )
    const avgProb = myClients.length > 0 ? Math.round(probSum / myClients.length) : 0

    const contractedThisMonth = myClients.filter(
      (c) =>
        c.sales_status === 'CONTRACTED' &&
        new Date(c.updated_at) >= monthStart,
    ).length

    const lastActivityIso = myActivities[0]?.created_at as string | undefined
    const daysSinceLastActivity =
      lastActivityIso != null
        ? Math.floor((now.getTime() - new Date(lastActivityIso).getTime()) / DAY)
        : null

    let spinSum = 0
    let spinCount = 0
    for (const c of mySpinCalls) {
      const a = c.analysis as CallAnalysisResult | null
      if (!a?.spin_feedback) continue
      spinSum += spinScore(a)
      spinCount++
    }
    const spinAvg = spinCount > 0 ? Math.round((spinSum / spinCount) * 10) / 10 : null

    const riskFlags: Member['risk_flags'] = []
    if (overdueFollowups >= 3) riskFlags.push('followup_overdue')
    if (daysSinceLastActivity != null && daysSinceLastActivity >= 3) {
      riskFlags.push('low_activity')
    } else if (
      lastActivityIso == null &&
      myActivities.length === 0 &&
      // Member with no activity history and at least one client → flag low activity
      myClients.length > 0
    ) {
      riskFlags.push('low_activity')
    }
    const neglectedHighProb = highProbClients.filter(
      (c) =>
        !c.last_contacted_at || new Date(c.last_contacted_at) <= sevenDaysAgo,
    ).length
    if (neglectedHighProb > 0) riskFlags.push('high_prob_neglected')
    void threeDaysAgo

    return {
      id: m.id,
      full_name: m.full_name,
      avatar_url: m.avatar_url ?? null,
      stats: {
        total_clients: myClients.length,
        contracted_this_month: contractedThisMonth,
        calls_this_week: myCallsWeek.length,
        overdue_followups: overdueFollowups,
        high_prob_clients: highProbClients.length,
        avg_contract_probability: avgProb,
        days_since_last_activity: daysSinceLastActivity,
        spin_avg_score: spinAvg,
      },
      risk_flags: riskFlags,
    }
  })

  const team_totals: TeamTotals = {
    members: members.length,
    clients: clients.length,
    contracted_this_month: out.reduce(
      (acc, m) => acc + m.stats.contracted_this_month,
      0,
    ),
    calls_this_week: out.reduce((acc, m) => acc + m.stats.calls_this_week, 0),
    overdue_followups: out.reduce((acc, m) => acc + m.stats.overdue_followups, 0),
  }

  return NextResponse.json({ members: out, team_totals })
}
