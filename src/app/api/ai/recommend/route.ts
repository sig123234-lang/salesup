import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getOpenAIClient } from '@/lib/openai/server'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const openai = getOpenAIClient()
    // 사용자의 거래처 데이터 가져오기
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

    const prompt = `다음 영업 거래처 목록을 분석하여 재방문/재연락 우선순위를 추천해주세요.
오늘 날짜: ${new Date().toLocaleDateString('ko-KR')}

거래처 목록:
${JSON.stringify(clientsData, null, 2)}

각 거래처에 대해 다음을 분석해주세요:
- 재연락 필요성 (점수 0-100)
- 추천 이유 (1-2문장)
- 추천 액션 유형 (REVISIT/FOLLOW_UP/UPSELL/RETENTION)

상위 5개만 추천해주세요.

JSON 형식으로 응답:
{
  "recommendations": [
    {
      "client_id": "...",
      "score": 85,
      "type": "REVISIT",
      "reason": "...",
      "expires_in_days": 3
    }
  ]
}`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    })

    const result = JSON.parse(completion.choices[0].message.content || '{}')
    const recommendations = result.recommendations || []

    // Supabase에 저장
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7)

    await supabase.from('ai_recommendations').delete().eq('user_id', user.id).eq('is_dismissed', false)

    const inserts = recommendations.map((r: { client_id: string; score: number; type: string; reason: string; expires_in_days: number }) => {
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
    const message = error instanceof Error && error.message === 'Missing OPENAI_API_KEY'
      ? 'OPENAI_API_KEY is not configured'
      : 'Recommendation failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
