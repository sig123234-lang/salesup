import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { SalesStatus } from '@/types'

interface MonthBucket {
  month: string // 'YYYY-MM'
  label: string // '6월' style
  contracts: number
}

interface StageBucket {
  status: SalesStatus
  count: number
}

interface MonthlyStats {
  month: string
  contracts: number
  calls: number
  visits: number
  goal: {
    contracts: number
    calls: number
    visits: number
  }
  trend: MonthBucket[] // last 3 months (incl. current)
  by_stage: StageBucket[]
}

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function monthStart(year: number, monthIdx: number) {
  return new Date(year, monthIdx, 1)
}

const DEFAULT_GOAL = { contracts: 5, calls: 50, visits: 20 }

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const now = new Date()
  const currentMonthStart = monthStart(now.getFullYear(), now.getMonth())
  const nextMonthStart = monthStart(now.getFullYear(), now.getMonth() + 1)
  const twoMonthsAgoStart = monthStart(now.getFullYear(), now.getMonth() - 2)

  const { data: profileRow } = await supabase
    .from('profiles')
    .select('metadata')
    .eq('id', user.id)
    .single()

  const meta = (profileRow?.metadata as Record<string, unknown> | null) ?? {}
  const goalRaw = (meta.monthly_goal as Partial<typeof DEFAULT_GOAL> | undefined) ?? {}
  const goal = {
    contracts: goalRaw.contracts ?? DEFAULT_GOAL.contracts,
    calls: goalRaw.calls ?? DEFAULT_GOAL.calls,
    visits: goalRaw.visits ?? DEFAULT_GOAL.visits,
  }

  const [
    contractsThisMonth,
    callsThisMonth,
    visitsThisMonth,
    contractsTrend,
    clientsByStage,
  ] = await Promise.all([
    supabase
      .from('clients')
      .select('id', { count: 'exact', head: true })
      .eq('owner_id', user.id)
      .eq('sales_status', 'CONTRACTED')
      .gte('updated_at', currentMonthStart.toISOString())
      .lt('updated_at', nextMonthStart.toISOString()),
    supabase
      .from('call_records')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', currentMonthStart.toISOString())
      .lt('created_at', nextMonthStart.toISOString()),
    supabase
      .from('visit_records')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', currentMonthStart.toISOString())
      .lt('created_at', nextMonthStart.toISOString()),
    supabase
      .from('clients')
      .select('updated_at')
      .eq('owner_id', user.id)
      .eq('sales_status', 'CONTRACTED')
      .gte('updated_at', twoMonthsAgoStart.toISOString())
      .lt('updated_at', nextMonthStart.toISOString()),
    supabase
      .from('clients')
      .select('sales_status')
      .eq('owner_id', user.id),
  ])

  // Build last-3-months trend (oldest first)
  const trend: MonthBucket[] = []
  for (let i = 2; i >= 0; i--) {
    const start = monthStart(now.getFullYear(), now.getMonth() - i)
    trend.push({
      month: monthKey(start),
      label: `${start.getMonth() + 1}월`,
      contracts: 0,
    })
  }
  for (const row of contractsTrend.data ?? []) {
    const d = new Date(row.updated_at as string)
    const key = monthKey(d)
    const bucket = trend.find((t) => t.month === key)
    if (bucket) bucket.contracts++
  }

  // Stage distribution
  const stageCounts: Record<string, number> = {}
  for (const row of clientsByStage.data ?? []) {
    const s = row.sales_status as SalesStatus
    stageCounts[s] = (stageCounts[s] ?? 0) + 1
  }
  const by_stage: StageBucket[] = Object.entries(stageCounts).map(([status, count]) => ({
    status: status as SalesStatus,
    count,
  }))

  const stats: MonthlyStats = {
    month: monthKey(currentMonthStart),
    contracts: contractsThisMonth.count ?? 0,
    calls: callsThisMonth.count ?? 0,
    visits: visitsThisMonth.count ?? 0,
    goal,
    trend,
    by_stage,
  }

  return NextResponse.json({ data: stats })
}

export async function PUT(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const goal = {
    contracts: Math.max(0, Number(body.contracts) || 0),
    calls: Math.max(0, Number(body.calls) || 0),
    visits: Math.max(0, Number(body.visits) || 0),
  }

  const { data: profileRow } = await supabase
    .from('profiles')
    .select('metadata')
    .eq('id', user.id)
    .single()

  const nextMeta = {
    ...((profileRow?.metadata as Record<string, unknown>) ?? {}),
    monthly_goal: goal,
  }
  await supabase.from('profiles').update({ metadata: nextMeta }).eq('id', user.id)
  return NextResponse.json({ data: goal })
}
