import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { jsonCompletion } from '@/lib/ai/unified'
import type { MEDDIC } from '@/types'

const SYSTEM_PROMPT = `당신은 영업 자격 검증 분석가입니다. 주어진 통화 기록과 메모에서
다음 MEDDIC 6요소를 한국어 1~2문장씩 추출하여 JSON으로 반환합니다.
- metrics: 성공의 정량 지표
- economic_buyer: 실제 결정권자
- decision_criteria: 구매 기준
- decision_process: 의사결정 과정
- identify_pain: 핵심 문제
- champion: 내부 지지자

규칙:
1. 텍스트에서 명시되지 않은 항목은 빈 문자열로 두세요.
2. 이미 사용자가 입력한 값(current)이 있으면 덮어쓰지 말고 그대로 유지하세요.
3. JSON만 출력 (마크다운 코드블럭 금지).

응답 형식:
{
  "meddic": {
    "metrics": "...",
    "economic_buyer": "...",
    "decision_criteria": "...",
    "decision_process": "...",
    "identify_pain": "...",
    "champion": "..."
  }
}`

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const text: string = body.text || ''
    const current: MEDDIC = body.current || {}
    if (!text.trim()) {
      return NextResponse.json({ error: '분석할 텍스트가 없습니다.' }, { status: 400 })
    }

    const userPrompt = `현재 값:\n${JSON.stringify(current, null, 2)}\n\n분석할 내용:\n${text}`

    const { data } = await jsonCompletion<{ meddic: MEDDIC }>({
      task: 'analyze',
      systemPrompt: SYSTEM_PROMPT,
      userPrompt,
      maxTokens: 1024,
    })

    // Don't overwrite fields the user already filled.
    const merged: MEDDIC = { ...(data.meddic ?? {}) }
    ;(Object.keys(current) as Array<keyof MEDDIC>).forEach((k) => {
      if (current[k]?.trim()) merged[k] = current[k]
    })

    return NextResponse.json({ meddic: merged })
  } catch (err) {
    console.error('meddic-fill error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed' },
      { status: 500 },
    )
  }
}
