import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(req: NextRequest) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { transcript, type, clientContext } = await req.json()

    const systemPrompt = `당신은 영업 전문 AI 분석가입니다.
영업사원의 ${type === 'call' ? '통화 내용' : '방문 내용'}을 분석하여 JSON 형식으로 응답해주세요.

분석 항목:
1. 고객의 가격 민감도 (LOW/MEDIUM/HIGH)
2. 관심도 (LOW/MEDIUM/HIGH)
3. 경쟁사 언급 여부 및 이름
4. 계약 가능성 (0-100 숫자)
5. 고객 반응 요약 (2문장 이내)
6. 추천 액션 (3개 이내)
7. 다음 연락 추천 날짜 (ISO 형식 또는 null)
8. 전체 대화 요약 (3문장 이내)
9. 핵심 키워드 (5개 이내 배열)
10. 후속 연락 시 사용할 추천 멘트

JSON 형식:
{
  "price_sensitivity": "...",
  "interest_level": "...",
  "competitor_mentioned": false,
  "competitor_names": [],
  "contract_probability": 50,
  "customer_reaction": "...",
  "recommended_actions": ["...", "...", "..."],
  "next_contact_date": null,
  "summary": "...",
  "keywords": ["...", "..."],
  "follow_up_message": "..."
}`

    const userPrompt = `고객 정보: ${clientContext || '없음'}

${type === 'call' ? '통화' : '방문'} 내용:
${transcript}`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    })

    const analysis = JSON.parse(completion.choices[0].message.content || '{}')
    return NextResponse.json({ analysis })
  } catch (error) {
    console.error('Analysis error:', error)
    return NextResponse.json({ error: 'Analysis failed' }, { status: 500 })
  }
}
