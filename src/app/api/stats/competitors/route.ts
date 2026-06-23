import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { CallAnalysisResult, SalesStatus } from '@/types'

interface CompetitorStat {
  name: string
  count: number
  win_rate: number
  avg_probability_when_mentioned: number
  related_client_ids: string[]
  win_rate_note?: string
}

interface CompetitorStatsResponse {
  competitors: CompetitorStat[]
  total_calls_with_competitors: number
  total_calls: number
}

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000

function activityImpliesContracted(content: string | null, metadata: unknown): boolean {
  const text = (content ?? '').toUpperCase()
  if (text.includes('CONTRACTED')) return true
  const meta = (metadata ?? {}) as Record<string, unknown>
  const to = String(meta.to ?? meta.new_status ?? meta.status ?? '').toUpperCase()
  return to === 'CONTRACTED'
}

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [callsRes, totalRes] = await Promise.all([
    supabase
      .from('call_records')
      .select('client_id, analysis, created_at')
      .eq('user_id', user.id)
      .not('analysis', 'is', null)
      .order('created_at', { ascending: false })
      .limit(500),
    supabase
      .from('call_records')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id),
  ])

  type CallMention = {
    client_id: string | null
    created_at: string
    probability: number
  }

  const buckets: Record<
    string,
    {
      count: number
      probabilitySum: number
      clientIds: Set<string>
      // Per-mention metadata so we can resolve a *temporal* win rate
      mentions: CallMention[]
    }
  > = {}
  let callsWithCompetitors = 0

  for (const row of callsRes.data ?? []) {
    const analysis = row.analysis as CallAnalysisResult | null
    if (!analysis) continue
    const names = (analysis.competitor_names ?? []).filter(
      (n): n is string => typeof n === 'string' && n.trim().length > 0,
    )
    if (names.length === 0) continue
    callsWithCompetitors++

    const prob = typeof analysis.contract_probability === 'number'
      ? analysis.contract_probability
      : 0
    const clientId = (row.client_id as string | null) ?? null
    const createdAt = row.created_at as string

    for (const raw of names) {
      const name = raw.trim()
      const bucket = (buckets[name] ??= {
        count: 0,
        probabilitySum: 0,
        clientIds: new Set<string>(),
        mentions: [],
      })
      bucket.count++
      bucket.probabilitySum += prob
      if (clientId) bucket.clientIds.add(clientId)
      bucket.mentions.push({ client_id: clientId, created_at: createdAt, probability: prob })
    }
  }

  const allClientIds = Array.from(
    new Set(Object.values(buckets).flatMap((b) => Array.from(b.clientIds))),
  )

  // Pull STATUS_CHANGE activities for the touched clients in one round-trip.
  // We will use these to decide whether each call mention "won" (became
  // CONTRACTED within 90 days after the call).
  type StatusActivity = {
    client_id: string
    created_at: string
    content: string | null
    metadata: unknown
  }
  let statusActivities: StatusActivity[] = []
  const currentStatusMap = new Map<string, SalesStatus>()
  if (allClientIds.length > 0) {
    const [activitiesRes, clientsRes] = await Promise.all([
      supabase
        .from('activities')
        .select('client_id, created_at, content, metadata')
        .in('client_id', allClientIds)
        .eq('type', 'STATUS_CHANGE'),
      supabase
        .from('clients')
        .select('id, sales_status')
        .in('id', allClientIds),
    ])
    statusActivities = (activitiesRes.data ?? []) as StatusActivity[]
    for (const c of clientsRes.data ?? []) {
      currentStatusMap.set(c.id as string, c.sales_status as SalesStatus)
    }
  }

  // Pre-bucket status activities per client for fast lookup
  const statusByClient: Record<string, StatusActivity[]> = {}
  for (const a of statusActivities) {
    const list = (statusByClient[a.client_id] ??= [])
    list.push(a)
  }

  function wonAfter(clientId: string | null, callTime: string): boolean {
    if (!clientId) return false
    const callMs = new Date(callTime).getTime()
    const activities = statusByClient[clientId]
    if (activities && activities.length > 0) {
      for (const a of activities) {
        const ams = new Date(a.created_at).getTime()
        if (ams > callMs && ams - callMs <= NINETY_DAYS_MS) {
          if (activityImpliesContracted(a.content, a.metadata)) return true
        }
      }
      return false
    }
    // No STATUS_CHANGE history → no temporal signal available
    return false
  }

  const competitors: CompetitorStat[] = Object.entries(buckets)
    .map(([name, b]) => {
      // Mentions where we *can* assess temporal outcome
      const assessable = b.mentions.filter((m) =>
        m.client_id ? (statusByClient[m.client_id]?.length ?? 0) > 0 : false,
      )
      let winRate = 0
      let note: string | undefined

      if (assessable.length >= 2) {
        const wins = assessable.filter((m) => wonAfter(m.client_id, m.created_at)).length
        winRate = Math.round((wins / assessable.length) * 100)
      } else {
        // Fallback: use current sales_status snapshot. Less accurate temporally.
        const ids = Array.from(b.clientIds)
        const contracted = ids.filter(
          (id) => currentStatusMap.get(id) === 'CONTRACTED',
        ).length
        winRate = ids.length > 0 ? Math.round((contracted / ids.length) * 100) : 0
        note = '데이터 부족, 참고용'
      }

      return {
        name,
        count: b.count,
        win_rate: winRate,
        avg_probability_when_mentioned:
          b.count > 0 ? Math.round(b.probabilitySum / b.count) : 0,
        related_client_ids: Array.from(b.clientIds),
        ...(note ? { win_rate_note: note } : {}),
      }
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 20)

  const response: CompetitorStatsResponse = {
    competitors,
    total_calls_with_competitors: callsWithCompetitors,
    total_calls: totalRes.count ?? 0,
  }
  return NextResponse.json({ data: response })
}
