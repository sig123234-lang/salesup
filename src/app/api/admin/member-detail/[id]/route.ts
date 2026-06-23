import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { jsonCompletion } from '@/lib/ai/unified'
import type { CallAnalysisResult, Client } from '@/types'

interface RouteContext {
  params: Promise<{ id: string }>
}

const DAY = 24 * 60 * 60 * 1000

const COACH_PROMPT = `당신은 영업 팀장의 코치입니다. 팀원 활동 데이터를 보고
지금 당장 코칭해야 할 가장 중요한 포인트 1가지를 작성하세요.

규칙:
- 한국어, 친근하지만 구체적
- 칭찬 1줄 + 개선 1줄 + 실행 액션 1줄 구조
- 데이터에 없는 사실 추가 금지
- 모르는 경우 솔직히 "데이터 부족" 인정

응답 JSON (마크다운 없이):
{
  "coaching_point": {
    "praise": "잘하고 있는 점 1줄",
    "improvement": "개선 필요한 점 1줄",
    "action": "이번 주 안에 실행할 액션 1줄"
  }
}`

export async function GET(_req: NextRequest, ctx: RouteContext) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: requester } = await supabase
    .from('profiles')
    .select('role, company_id')
    .eq('id', user.id)
    .single()
  if (
    !requester ||
    (requester.role !== 'COMPANY_ADMIN' && requester.role !== 'SUPER_ADMIN')
  ) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id: memberId } = await ctx.params
  const { data: member } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url, company_id, role')
    .eq('id', memberId)
    .single()
  if (!member) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (member.company_id !== requester.company_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const now = new Date()
  const thirtyAgo = new Date(now.getTime() - 30 * DAY)
  const sevenAgo = new Date(now.getTime() - 7 * DAY)

  const [activitiesRes, callsRes, riskRes] = await Promise.all([
    supabase
      .from('activities')
      .select('id, type, content, created_at, client:clients(id, name)')
      .eq('user_id', memberId)
      .gte('created_at', thirtyAgo.toISOString())
      .order('created_at', { ascending: false })
      .limit(80),
    supabase
      .from('call_records')
      .select('id, analysis, created_at, client:clients(id, name)')
      .eq('user_id', memberId)
      .not('analysis', 'is', null)
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('clients')
      .select(
        'id, name, sales_status, contract_probability, last_contacted_at, next_contact_at',
      )
      .eq('owner_id', memberId)
      .neq('sales_status', 'REJECTED'),
  ])

  const activities = activitiesRes.data ?? []
  const calls = callsRes.data ?? []
  const allClients = (riskRes.data ?? []) as Pick<
    Client,
    'id' | 'name' | 'sales_status' | 'contract_probability' | 'last_contacted_at' | 'next_contact_at'
  >[]

  const riskClients = allClients
    .filter((c) => {
      const overdue =
        c.next_contact_at && new Date(c.next_contact_at) <= now &&
        c.sales_status !== 'CONTRACTED'
      const neglectedHigh =
        c.contract_probability >= 70 &&
        c.sales_status !== 'CONTRACTED' &&
        (!c.last_contacted_at || new Date(c.last_contacted_at) <= sevenAgo)
      return overdue || neglectedHigh
    })
    .slice(0, 15)

  let coaching: { praise: string; improvement: string; action: string } = {
    praise: '데이터 부족',
    improvement: '활동 기록이 더 쌓이면 정확한 코칭이 가능합니다',
    action: '먼저 통화/방문 기록을 시작해보세요',
  }

  try {
    const userPrompt = JSON.stringify({
      member: { name: member.full_name },
      window_days: 30,
      counts: {
        activities: activities.length,
        calls: calls.length,
        clients: allClients.length,
        risk_clients: riskClients.length,
      },
      recent_call_summaries: calls.slice(0, 8).map((c) => {
        const a = c.analysis as CallAnalysisResult | null
        return {
          probability: a?.contract_probability ?? null,
          summary: a?.summary ?? null,
          spin: a?.spin_feedback ?? null,
        }
      }),
      risk_clients: riskClients.map((c) => ({
        name: c.name,
        status: c.sales_status,
        probability: c.contract_probability,
        last_contacted_at: c.last_contacted_at,
        next_contact_at: c.next_contact_at,
      })),
    })
    const result = await jsonCompletion<{
      coaching_point: {
        praise: string
        improvement: string
        action: string
      }
    }>({
      task: 'recommend',
      systemPrompt: COACH_PROMPT,
      userPrompt,
      maxTokens: 600,
      temperature: 0.5,
    })
    if (result.data?.coaching_point) {
      coaching = {
        praise: result.data.coaching_point.praise || coaching.praise,
        improvement: result.data.coaching_point.improvement || coaching.improvement,
        action: result.data.coaching_point.action || coaching.action,
      }
    }
  } catch (err) {
    console.error('member-detail AI coach error:', err)
  }

  return NextResponse.json({
    member: {
      id: member.id,
      full_name: member.full_name,
      avatar_url: member.avatar_url,
    },
    activities: activities.map((a) => ({
      id: a.id,
      type: a.type,
      content: a.content,
      created_at: a.created_at,
      client: a.client,
    })),
    risk_clients: riskClients,
    coaching_point: coaching,
  })
}
