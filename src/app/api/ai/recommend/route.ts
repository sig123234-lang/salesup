import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { jsonCompletion } from '@/lib/ai/unified'
import { buildRecommendPrompt } from '@/lib/claude/prompts'

type RawRecommendation = {
  client_id: string
  score: number
  type: 'REVISIT' | 'FOLLOW_UP' | 'UPSELL' | 'RETENTION'
  reason: string
  suggested_action?: string
  best_contact_time?: string
  expires_in_days?: number
}

export async function POST() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { data: clients } = await supabase
      .from('clients')
      .select('id, name, sales_status, contract_probability, last_contacted_at, next_contact_at, industry, memo')
      .eq('owner_id', user.id)
      .neq('sales_status', 'CONTRACTED')
      .neq('sales_status', 'REJECTED')
      .order('last_contacted_at', { ascending: true, nullsFirst: true })
      .limit(20)

    if (!clients || clients.length === 0) {
      return NextResponse.json({ recommendations: [] })
    }

    const clientsData = clients.map((c) => ({
      id: c.id,
      name: c.name,
      status: c.sales_status,
      probability: c.contract_probability,
      lastContact: c.last_contacted_at,
      nextContact: c.next_contact_at,
      industry: c.industry,
      memo: c.memo?.slice(0, 100),
    }))

    const todayDate = new Date().toISOString().slice(0, 10)
    const systemPrompt = buildRecommendPrompt(todayDate)
    const userPrompt = `거래처 목록:\n${JSON.stringify(clientsData, null, 2)}\n\n상위 5개만 우선순위 순으로 추천해주세요.`

    const { data: result } = await jsonCompletion<{ recommendations: RawRecommendation[] }>({
      task: 'recommend',
      systemPrompt,
      userPrompt,
      maxTokens: 2048,
    })

    const recommendations = result.recommendations || []

    await supabase
      .from('ai_recommendations')
      .delete()
      .eq('user_id', user.id)
      .eq('is_dismissed', false)

    const inserts = recommendations.map((r) => {
      const exp = new Date()
      exp.setDate(exp.getDate() + (r.expires_in_days || 7))
      return {
        user_id: user.id,
        client_id: r.client_id,
        type: r.type,
        reason: r.reason,
        score: r.score,
        expires_at: exp.toISOString(),
      }
    })

    if (inserts.length > 0) {
      await supabase.from('ai_recommendations').insert(inserts)
    }

    return NextResponse.json({ recommendations })
  } catch (error) {
    console.error('Recommendation error:', error)
    const message =
      error instanceof Error && /ANTHROPIC_API_KEY|OPENAI_API_KEY/.test(error.message)
        ? error.message
        : 'Recommendation failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
